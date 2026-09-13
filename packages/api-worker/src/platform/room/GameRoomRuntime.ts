/** Generic room authority: typed RPC dispatch, atomic storage, realtime, and outbox drain. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import {
  REASON_NO_STATE,
  REASON_NOT_HOST,
  REASON_ROOM_EFFECTS_PENDING,
} from '@game-judge/game-engine/platform/protocol/reasons';
import {
  type BaseGameState,
  createStateSyncResponseMessage,
  createStateUpdateMessage,
  parseStateSyncRequestMessage,
  type RoomSnapshot,
  type StateSyncRequestMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  parseUserEventAckMessage,
  type UserEventAckMessage,
} from '@game-judge/game-engine/platform/protocol/userEvents';
import * as Sentry from '@sentry/cloudflare';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../../env';
import { createEffectCommandId } from '../gameModules/effectCommandId';
import type {
  RuntimeWorkerGameModule,
  WorkerGameModuleResolver,
} from '../gameModules/runtimeGameModule';
import { createLogger } from '../observability/logger';
import {
  getWebSocketMessageByteLength,
  type RealtimeTrafficMessageType,
  recordRealtimeTraffic,
} from '../telemetry/realtimeTraffic';
import { acknowledgeUserEvent, enqueueUserEvent, readNextUserEvent } from '../userEvents/inbox';
import { dispatchRoomCommand } from './actionPipeline';
import { EffectOutbox, OUTBOX_MAX_ATTEMPTS } from './effectOutbox';
import type { IGameRoomRPC } from './IGameRoomRPC';
import { handlePlatformRoomEffect, parsePlatformRoomEffect } from './platformEffects';
import { assertRoomEffectDirectory } from './roomDirectory';
import { RoomRepository } from './roomRepository';
import { initializeRoomStorage } from './storageSchema';
import type {
  AuthorizeRoomDeletionCommand,
  AuthorizeRoomDeletionResult,
  DeleteRoomStorageCommand,
  DeleteRoomStorageResult,
  DispatchInternalRoomCommand,
  DispatchRoomCommand,
  DispatchRoomResult,
  DispatchUserRoomCommand,
  InitializeRoomCommand,
  InitializeRoomResult,
  PendingOutboxEffect,
  ReadEffectReplayCommand,
  ReadRoomCommand,
  ReplayFailedEffectCommand,
  RoomInstanceIdentity,
} from './types';

const OUTBOX_DRAIN_BATCH_SIZE = 16;
const USER_SOCKET_TAG_PREFIX = 'user:';

const log = createLogger('GameRoom');

function userSocketTag(userId: string): string {
  return `${USER_SOCKET_TAG_PREFIX}${userId}`;
}

function assertEffectType(effect: PendingOutboxEffect): void {
  if (
    typeof effect.payload !== 'object' ||
    effect.payload === null ||
    !('type' in effect.payload) ||
    effect.payload.type !== effect.effectType
  ) {
    throw new Error(`Outbox effect ${effect.id} type does not match its payload`);
  }
}

export abstract class GameRoomRuntime extends DurableObject<Env> implements IGameRoomRPC {
  readonly #repository: RoomRepository;
  readonly #outbox: EffectOutbox;
  readonly #gameModuleResolver: WorkerGameModuleResolver;
  #isStorageDeleted = false;

  protected abstract resolveGameModule(gameType: GameType): RuntimeWorkerGameModule;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#gameModuleResolver = (gameType) => this.resolveGameModule(gameType);
    this.#repository = new RoomRepository(ctx.storage, this.#gameModuleResolver);
    this.#outbox = new EffectOutbox(ctx.storage);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      initializeRoomStorage(ctx.storage, Date.now());
      await this.#schedulePendingOutbox();
    });
  }

  async initializeRoom(command: InitializeRoomCommand): Promise<InitializeRoomResult> {
    if (this.#isStorageDeleted) {
      throw new Error('Deleted room storage cannot be initialized again');
    }
    this.#readRoomInstance(command);
    return this.#repository.initialize(command, Date.now());
  }

  async dispatchUserCommand(command: DispatchUserRoomCommand): Promise<DispatchRoomResult> {
    if (command.actorUserId.length === 0) {
      throw new Error('dispatchUserCommand.actorUserId must be non-empty');
    }
    return this.#dispatchCommand(command, {
      roomCode: command.roomCode,
      commandId: command.commandId,
      actor: { kind: 'user', userId: command.actorUserId },
      controlledSeat: command.controlledSeat,
      command: command.command,
    });
  }

  async dispatchInternalCommand(command: DispatchInternalRoomCommand): Promise<DispatchRoomResult> {
    if (command.systemActorId.length === 0) {
      throw new Error('dispatchInternalCommand.systemActorId must be non-empty');
    }
    return this.#dispatchCommand(command, {
      roomCode: command.roomCode,
      commandId: command.commandId,
      actor: { kind: 'system', effectId: command.systemActorId },
      controlledSeat: null,
      command: command.command,
    });
  }

  async #dispatchCommand(
    identity: RoomInstanceIdentity,
    command: DispatchRoomCommand,
  ): Promise<DispatchRoomResult> {
    if (this.#isStorageDeleted) {
      return { kind: 'unavailable', reason: REASON_NO_STATE };
    }
    const room = this.#readRoomInstance(identity);
    if (room === null) {
      return { kind: 'unavailable', reason: REASON_NO_STATE };
    }
    const pipeline = await dispatchRoomCommand(
      this.#repository,
      this.#gameModuleResolver,
      command,
      Date.now(),
    );
    if (
      pipeline.rpc.kind === 'decided' &&
      !pipeline.rpc.isReplay &&
      pipeline.rpc.result.kind === 'committed' &&
      pipeline.broadcast === 'state'
    ) {
      this.#broadcast(pipeline.rpc.result.snapshot, pipeline.commandType);
    }
    if (pipeline.rpc.kind === 'decided' && pipeline.rpc.result.kind === 'committed') {
      const actorUserId = command.actor.kind === 'user' ? command.actor.userId : null;
      return {
        ...pipeline.rpc,
        result: {
          ...pipeline.rpc.result,
          snapshot: this.#projectSnapshotForUser(pipeline.rpc.result.snapshot, actorUserId),
        },
      };
    }
    return pipeline.rpc;
  }

  /** Requeue only effects whose owning game explicitly permits audited recovery. */
  async replayFailedEffect(command: ReplayFailedEffectCommand): Promise<void> {
    const room = this.#readRoomInstance(command);
    if (room === null) throw new Error('Cannot replay an effect without its room');
    if (command.id.trim().length === 0 || command.reason.trim().length === 0)
      throw new Error('Replay requires a request ID and reason');
    await this.#outbox.replayFailedEffect(
      command.id,
      command.effectId,
      command.reason,
      (effect) => {
        if (effect.scope !== 'game' || effect.gameType !== room.gameType) return false;
        assertEffectType(effect);
        return this.#gameModuleResolver(room.gameType).canReplayFailedEffect(effect.payload);
      },
    );
  }

  /** Read recovery audit data for the exact immutable room instance. */
  async readEffectReplay(
    command: ReadEffectReplayCommand,
  ): Promise<Record<string, SqlStorageValue> | null> {
    this.#readRoomInstance(command);
    return this.#outbox.readReplay(command.id);
  }

  async getSnapshot(
    command: ReadRoomCommand,
  ): Promise<RoomSnapshot<BaseGameState<GameType>> | null> {
    if (this.#isStorageDeleted) return null;
    this.#readRoomInstance(command);
    return this.#repository.readSnapshot();
  }

  async authorizeRoomDeletion(
    command: AuthorizeRoomDeletionCommand,
  ): Promise<AuthorizeRoomDeletionResult> {
    if (this.#isStorageDeleted) return { success: false, reason: REASON_NO_STATE };
    const room = this.#readRoomInitialization(command);
    if (room === null) return { success: false, reason: REASON_NO_STATE };
    if (command.actorUserId !== room.hostUserId) {
      return { success: false, reason: REASON_NOT_HOST };
    }
    if (this.#outbox.hasOutstandingEffects()) {
      return { success: false, reason: REASON_ROOM_EFFECTS_PENDING };
    }
    return { success: true };
  }

  async deleteRoomStorage(command: DeleteRoomStorageCommand): Promise<DeleteRoomStorageResult> {
    this.#assertIdentityFields(command);
    if (this.#isStorageDeleted) return { success: true };

    this.#readRoomInitialization(command);
    if (this.#outbox.hasOutstandingEffects()) {
      if (!command.shouldDiscardFailedEffects || this.#outbox.hasPendingEffects()) {
        return { success: false, reason: REASON_ROOM_EFFECTS_PENDING };
      }
      const discardedFailedEffectCount = this.#outbox.discardFailedEffects();
      log.warn('discarded failed effects during stale room deletion', {
        roomCode: command.roomCode,
        discardedFailedEffectCount,
      });
    }

    for (const socket of this.ctx.getWebSockets()) {
      socket.close(1000, 'room_deleted');
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.#isStorageDeleted = true;
    return { success: true };
  }

  async alarm(): Promise<void> {
    if (this.#isStorageDeleted) return;
    for (let processed = 0; processed < OUTBOX_DRAIN_BATCH_SIZE; processed += 1) {
      const claim = await this.#outbox.claimNextDue(Date.now());
      if (claim.kind === 'empty') break;
      if (claim.kind === 'exhausted') {
        const exhausted = new Error(
          `Outbox effect exhausted after interrupted delivery: ${claim.effect.id}`,
        );
        log.error('outbox effect exhausted', {
          effectId: claim.effect.id,
          effectType: claim.effect.effectType,
          attemptCount: claim.effect.attemptCount,
        });
        Sentry.captureException(exhausted, {
          tags: {
            gameType: claim.effect.gameType,
            effectType: claim.effect.effectType,
          },
          extra: { effectId: claim.effect.id },
        });
        await this.#terminalizeEffect(claim.effect, exhausted);
        continue;
      }
      const { effect } = claim;
      try {
        await this.#executeEffect(effect);
        this.#outbox.markSucceeded(effect.id);
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error));
        log.error('outbox effect failed', {
          effectId: effect.id,
          effectType: effect.effectType,
          attemptCount: effect.attemptCount,
          error: cause.message,
        });
        Sentry.captureException(cause, {
          tags: {
            gameType: effect.gameType,
            effectType: effect.effectType,
          },
          extra: { effectId: effect.id, attemptCount: effect.attemptCount },
        });
        if (effect.attemptCount >= OUTBOX_MAX_ATTEMPTS) {
          await this.#terminalizeEffect(effect, cause);
        } else {
          this.#outbox.markFailed(effect, cause, Date.now());
        }
      }
    }
    await this.#schedulePendingOutbox();
  }

  async #terminalizeEffect(effect: PendingOutboxEffect, cause: Error): Promise<void> {
    const commandId = await createEffectCommandId('outbox:terminal-failure', effect.id);
    const dispatched = await this.ctx.storage.transaction(async () => {
      assertEffectType(effect);
      const room = this.#repository.readRoom();
      if (room === null || room.gameType !== effect.gameType)
        throw new Error(`Cannot terminalize effect ${effect.id} without its room`);
      const command =
        effect.scope === 'game'
          ? this.#gameModuleResolver(room.gameType).getEffectFailureCommand(
              effect.payload,
              room.state,
            )
          : null;
      const result =
        command === null
          ? null
          : await dispatchRoomCommand(
              this.#repository,
              this.#gameModuleResolver,
              {
                roomCode: room.roomCode,
                commandId,
                actor: { kind: 'system', effectId: effect.id },
                controlledSeat: null,
                command,
              },
              Date.now(),
            );
      if (
        result !== null &&
        (result.rpc.kind !== 'decided' ||
          result.rpc.result.kind !== 'committed' ||
          result.rpc.result.outcome.kind !== 'success')
      ) {
        throw new Error(`Outbox terminal command ${commandId} did not commit successfully`);
      }
      this.#outbox.markFailed(effect, cause, Date.now());
      return result;
    });
    if (
      dispatched !== null &&
      dispatched.rpc.kind === 'decided' &&
      dispatched.rpc.result.kind === 'committed' &&
      !dispatched.rpc.isReplay &&
      dispatched.broadcast === 'state'
    ) {
      this.#broadcast(dispatched.rpc.result.snapshot, dispatched.commandType);
    }
  }

  async #executeEffect(effect: PendingOutboxEffect): Promise<void> {
    assertEffectType(effect);
    const room = this.#repository.readRoom();
    if (room === null) {
      throw new Error(`Room effect ${effect.id} has no room state`);
    }
    if (room.gameType !== effect.gameType) {
      throw new Error(`Game effect ${effect.id} does not match its room`);
    }
    const directoryIdentity = {
      roomId: this.ctx.id.toString(),
      roomCode: room.roomCode,
      creationId: room.creationId,
    };
    await assertRoomEffectDirectory(this.env, directoryIdentity);
    if (effect.scope === 'platform') {
      await handlePlatformRoomEffect(
        effect.id,
        parsePlatformRoomEffect(effect.payload),
        directoryIdentity,
        this.env,
      );
      return;
    }

    const module = this.#gameModuleResolver(room.gameType);
    await module.handleEffect(effect.payload, {
      bindings: this.env,
      effectId: effect.id,
      state: room.state,
      roomIdentity: directoryIdentity,
      createdRevision: effect.createdRevision,
      deliveryAttemptCount: effect.attemptCount,
      dispatchInternal: async (commandId, command) => {
        const dispatched = await dispatchRoomCommand(
          this.#repository,
          this.#gameModuleResolver,
          {
            roomCode: room.roomCode,
            commandId,
            actor: { kind: 'system', effectId: effect.id },
            controlledSeat: null,
            command,
          },
          Date.now(),
        );
        if (dispatched.rpc.kind !== 'decided') {
          throw new Error(`Internal effect command ${commandId} has no room state`);
        }
        if (
          !dispatched.rpc.isReplay &&
          dispatched.rpc.result.kind === 'committed' &&
          dispatched.broadcast === 'state'
        ) {
          this.#broadcast(dispatched.rpc.result.snapshot, dispatched.commandType);
        }
        return dispatched.rpc.result;
      },
      publishUserEvent: (userId, eventId, message) =>
        this.#publishUserEvent(userId, eventId, message),
    });
  }

  async #schedulePendingOutbox(): Promise<void> {
    const nextAvailableAt = this.#outbox.readNextAvailableAt();
    if (nextAvailableAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (existingAlarm === null || existingAlarm > nextAvailableAt) {
      await this.ctx.storage.setAlarm(nextAvailableAt);
    }
  }

  #recordRealtimeTraffic(
    messageType: RealtimeTrafficMessageType,
    message: string | ArrayBuffer,
    deliveryCount: number,
  ): void {
    recordRealtimeTraffic(this.env.REQUEST_TRAFFIC, {
      messageType,
      payloadBytes: getWebSocketMessageByteLength(message),
      deliveryCount,
      deploymentId: this.env.CF_VERSION_METADATA.id,
    });
  }

  #projectSnapshotForUser(
    snapshot: RoomSnapshot<BaseGameState<GameType>>,
    userId: string | null,
  ): RoomSnapshot<BaseGameState<GameType>> {
    const module = this.#gameModuleResolver(snapshot.gameType);
    return {
      ...snapshot,
      state: module.projectStateForUser(snapshot.state, userId),
    };
  }

  #getSocketUserId(socket: WebSocket): string {
    const userTags = this.ctx
      .getTags(socket)
      .filter((tag) => tag.startsWith(USER_SOCKET_TAG_PREFIX));
    if (userTags.length !== 1) {
      throw new Error(`WebSocket must have exactly one user tag, received ${userTags.length}`);
    }
    const userId = userTags[0]?.slice(USER_SOCKET_TAG_PREFIX.length);
    if (userId === undefined || userId.length === 0) {
      throw new Error('WebSocket user tag must contain a user ID');
    }
    return userId;
  }

  #broadcast(snapshot: RoomSnapshot<BaseGameState<GameType>>, commandType: string | null): void {
    const deliveryCounts = new Map<string, number>();
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const userId = this.#getSocketUserId(socket);
        const projectedSnapshot = this.#projectSnapshotForUser(snapshot, userId);
        const message = JSON.stringify(createStateUpdateMessage(projectedSnapshot, commandType));
        socket.send(message);
        deliveryCounts.set(message, (deliveryCounts.get(message) ?? 0) + 1);
      } catch (error) {
        log.warn('state broadcast skipped closed or invalid socket', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    for (const [message, deliveryCount] of deliveryCounts) {
      this.#recordRealtimeTraffic('STATE_UPDATE', message, deliveryCount);
    }
  }

  #pushUserEventToConnectedSockets(userId: string, message: object): void {
    const serialized = JSON.stringify(message);
    let deliveryCount = 0;
    for (const socket of this.ctx.getWebSockets(userSocketTag(userId))) {
      try {
        socket.send(serialized);
        deliveryCount += 1;
      } catch (error) {
        log.warn('unicast skipped closed socket', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.#recordRealtimeTraffic('USER_EVENT_DELIVERY', serialized, deliveryCount);
  }

  async #publishUserEvent(userId: string, eventId: string, message: object): Promise<void> {
    await enqueueUserEvent(this.env.DB, { userId, eventId, message });
    this.#pushUserEventToConnectedSockets(userId, message);
  }

  async #sendNextUserEvent(socket: WebSocket, userId: string): Promise<void> {
    const pending = await readNextUserEvent(this.env.DB, userId);
    if (pending === null) return;
    const serialized = JSON.stringify(pending.message);
    let deliveryCount = 0;
    try {
      socket.send(serialized);
      deliveryCount = 1;
    } catch (error) {
      log.warn('pending user event skipped closed socket', {
        userId,
        eventId: pending.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    this.#recordRealtimeTraffic('USER_EVENT_DELIVERY', serialized, deliveryCount);
  }

  async fetch(request: Request): Promise<Response> {
    if (this.#isStorageDeleted) return new Response('Room deleted', { status: 404 });
    const url = new URL(request.url);
    if (url.pathname !== '/websocket') {
      return new Response('Not Found', { status: 404 });
    }
    return this.#handleWebSocketUpgrade(url);
  }

  async #handleWebSocketUpgrade(url: URL): Promise<Response> {
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');
    const roomId = url.searchParams.get('roomId');
    const creationId = url.searchParams.get('creationId');
    if (
      userId === null ||
      userId.length === 0 ||
      roomCode === null ||
      roomCode.length === 0 ||
      roomId === null ||
      roomId.length === 0 ||
      creationId === null ||
      creationId.length === 0
    ) {
      return new Response('userId and room identity required', { status: 400 });
    }
    const room = this.#readRoomInstance({ roomCode, roomId, creationId });
    if (room === null) return new Response('Room not initialized', { status: 404 });

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [userSocketTag(userId)]);
    await this.#sendNextUserEvent(pair[1], userId);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  #assertIdentityFields(identity: RoomInstanceIdentity): void {
    if (
      identity.roomId.length === 0 ||
      identity.roomCode.length === 0 ||
      identity.creationId.length === 0
    ) {
      throw new Error('Room instance identity fields must be non-empty');
    }
    if (identity.roomId !== this.ctx.id.toString()) {
      throw new Error('Room identity does not match the addressed Durable Object');
    }
  }

  #assertRoomStorageIdentity(
    identity: RoomInstanceIdentity,
    storedIdentity: Pick<RoomInstanceIdentity, 'roomCode' | 'creationId'>,
  ): void {
    if (
      storedIdentity.roomCode !== identity.roomCode ||
      storedIdentity.creationId !== identity.creationId
    ) {
      throw new Error('Room identity does not match Durable Object storage');
    }
  }

  #readRoomInitialization(
    identity: RoomInstanceIdentity,
  ): ReturnType<RoomRepository['readRoomInitialization']> {
    this.#assertIdentityFields(identity);
    const initialization = this.#repository.readRoomInitialization();
    if (initialization === null) return null;
    this.#assertRoomStorageIdentity(identity, initialization);
    return initialization;
  }

  #readRoomInstance(identity: RoomInstanceIdentity): ReturnType<RoomRepository['readRoom']> {
    this.#assertIdentityFields(identity);
    const room = this.#repository.readRoom();
    if (room === null) return null;
    this.#assertRoomStorageIdentity(identity, room);
    return room;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.#isStorageDeleted) {
      socket.close(1000, 'room_deleted');
      return;
    }
    let clientMessage: StateSyncRequestMessage | UserEventAckMessage;
    try {
      if (typeof message !== 'string') {
        throw new Error('WebSocket client message must be text');
      }
      const decodedMessage: unknown = JSON.parse(message);
      if (
        typeof decodedMessage === 'object' &&
        decodedMessage !== null &&
        !Array.isArray(decodedMessage) &&
        'type' in decodedMessage &&
        decodedMessage.type === 'STATE_SYNC_REQUEST'
      ) {
        clientMessage = parseStateSyncRequestMessage(decodedMessage);
      } else {
        clientMessage = parseUserEventAckMessage(decodedMessage);
      }
    } catch (error) {
      this.#recordRealtimeTraffic('INVALID_CLIENT_MESSAGE', message, 1);
      log.error('invalid websocket client message', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      socket.close(1002, 'protocol_error');
      return;
    }

    this.#recordRealtimeTraffic(clientMessage.type, message, 1);
    const userId = this.#getSocketUserId(socket);

    if (clientMessage.type === 'STATE_SYNC_REQUEST') {
      const snapshot = this.#repository.readSnapshot();
      if (snapshot === null) {
        const error = new Error('Initialized room has no authoritative snapshot');
        log.error('state sync failed', { error: error.message });
        Sentry.captureException(error);
        socket.close(1011, 'state_unavailable');
        return;
      }
      const projectedSnapshot = this.#projectSnapshotForUser(snapshot, userId);
      const response = JSON.stringify(
        createStateSyncResponseMessage(clientMessage.requestId, projectedSnapshot),
      );
      socket.send(response);
      this.#recordRealtimeTraffic('STATE_SYNC_RESPONSE', response, 1);
      return;
    }

    await acknowledgeUserEvent(this.env.DB, userId, clientMessage.eventId);
    await this.#sendNextUserEvent(socket, userId);
  }

  async webSocketClose(
    socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    socket.close();
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    log.warn('websocket error', {
      error: error instanceof Error ? error.message : String(error),
    });
    socket.close();
  }
}

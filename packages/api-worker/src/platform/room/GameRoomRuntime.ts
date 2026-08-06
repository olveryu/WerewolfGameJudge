/** Generic room authority: typed RPC dispatch, atomic storage, realtime, and outbox drain. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import {
  REASON_NO_STATE,
  REASON_NOT_HOST,
  REASON_ROOM_EFFECTS_PENDING,
} from '@game-judge/game-engine/platform/protocol/reasons';
import {
  type BaseGameState,
  createStateUpdateMessage,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { parseUserEventAckMessage } from '@game-judge/game-engine/platform/protocol/userEvents';
import * as Sentry from '@sentry/cloudflare';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../../env';
import type {
  EffectExecutionResult,
  EffectTerminalReason,
  RuntimeWorkerEffectContext,
  RuntimeWorkerGameModule,
  WorkerGameModuleResolver,
} from '../gameModules/runtimeGameModule';
import { createLogger } from '../observability/logger';
import { acknowledgeUserEvent, enqueueUserEvent, readNextUserEvent } from '../userEvents/inbox';
import { dispatchRoomCommand } from './actionPipeline';
import { EffectOutbox } from './effectOutbox';
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
  DispatchRoomResult,
  DispatchUserRoomCommand,
  InitializeRoomCommand,
  InitializeRoomResult,
  PendingOutboxEffect,
  ReadRoomCommand,
  RoomInstanceIdentity,
  StoredRoomRow,
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
    if (this.#isStorageDeleted) {
      return { kind: 'unavailable', reason: REASON_NO_STATE };
    }
    const room = this.#readRoomInstance(command);
    if (room === null) {
      return { kind: 'unavailable', reason: REASON_NO_STATE };
    }
    if (command.actorUserId.length === 0) {
      throw new Error('dispatchUserCommand.actorUserId must be non-empty');
    }
    const pipeline = await dispatchRoomCommand(
      this.#repository,
      this.#gameModuleResolver,
      {
        roomCode: command.roomCode,
        commandId: command.commandId,
        actor: { kind: 'user', userId: command.actorUserId },
        controlledSeat: command.controlledSeat,
        command: command.command,
      },
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
    return pipeline.rpc;
  }

  async getSnapshot(
    command: ReadRoomCommand,
  ): Promise<RoomSnapshot<BaseGameState<GameType>> | null> {
    if (this.#isStorageDeleted) return null;
    this.#readRoomInstance(command);
    return this.#repository.readSnapshot();
  }

  async getRevision(command: ReadRoomCommand): Promise<number | null> {
    if (this.#isStorageDeleted) return null;
    this.#readRoomInstance(command);
    return this.#repository.readRoom()?.revision ?? null;
  }

  async authorizeRoomDeletion(
    command: AuthorizeRoomDeletionCommand,
  ): Promise<AuthorizeRoomDeletionResult> {
    if (this.#isStorageDeleted) return { success: false, reason: REASON_NO_STATE };
    const room = this.#readRoomInstance(command);
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

    this.#readRoomInstance(command);
    if (this.#outbox.hasOutstandingEffects()) {
      return { success: false, reason: REASON_ROOM_EFFECTS_PENDING };
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
        await this.#terminalizeEffect(claim.effect, {
          kind: 'attemptsExhausted',
          error: new Error(
            `Outbox effect exhausted after interrupted delivery: ${claim.effect.id}`,
          ),
        });
        continue;
      }
      await this.#processClaimedEffect(claim.effect);
    }
    await this.#schedulePendingOutbox();
  }

  async #processClaimedEffect(effect: PendingOutboxEffect): Promise<void> {
    const result = await this.#executeEffect(effect);
    switch (result.kind) {
      case 'success':
        this.#outbox.markSucceeded(effect.id);
        return;
      case 'retryable': {
        const retry = this.#outbox.markRetryable(effect, result.error, Date.now());
        if (retry.kind === 'scheduled') {
          log.warn('outbox effect retry scheduled', {
            effectId: effect.id,
            effectType: effect.effectType,
            attemptCount: effect.attemptCount,
            error: result.error.message,
          });
          return;
        }
        await this.#terminalizeEffect(effect, {
          kind: 'attemptsExhausted',
          error: result.error,
        });
        return;
      }
      case 'terminal':
        await this.#terminalizeEffect(effect, { kind: 'execution', error: result.error });
        return;
    }
    const exhaustive: never = result;
    return exhaustive;
  }

  async #executeEffect(effect: PendingOutboxEffect): Promise<EffectExecutionResult> {
    try {
      const room = this.#readEffectRoom(effect);
      const context = this.#createEffectContext(effect, room);
      await assertRoomEffectDirectory(this.env, context.roomIdentity);
      if (effect.scope === 'platform') {
        await handlePlatformRoomEffect(
          effect.id,
          parsePlatformRoomEffect(effect.payload),
          context.roomIdentity,
          this.env,
        );
        return { kind: 'success' };
      }

      const module = this.#gameModuleResolver(room.gameType);
      return await module.handleEffect(effect.payload, context);
    } catch (error) {
      return {
        kind: 'terminal',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async #terminalizeEffect(
    effect: PendingOutboxEffect,
    reason: EffectTerminalReason,
  ): Promise<void> {
    log.error('outbox effect terminal', {
      effectId: effect.id,
      effectType: effect.effectType,
      attemptCount: effect.attemptCount,
      terminalReason: reason.kind,
      error: reason.error.message,
    });
    Sentry.captureException(reason.error, {
      tags: {
        gameType: effect.gameType,
        effectType: effect.effectType,
        terminalReason: reason.kind,
      },
      extra: { effectId: effect.id, attemptCount: effect.attemptCount },
    });

    try {
      if (effect.scope === 'game') {
        const room = this.#readEffectRoom(effect);
        const context = this.#createEffectContext(effect, room);
        await assertRoomEffectDirectory(this.env, context.roomIdentity);
        const module = this.#gameModuleResolver(room.gameType);
        await module.handleTerminalEffect(effect.payload, context, reason);
      }
      this.#outbox.markSucceeded(effect.id);
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      log.error('outbox effect terminalization failed', {
        effectId: effect.id,
        effectType: effect.effectType,
        attemptCount: effect.attemptCount,
        error: cause.message,
      });
      Sentry.captureException(cause, {
        tags: {
          gameType: effect.gameType,
          effectType: effect.effectType,
          terminalReason: 'terminalizationFailed',
        },
        extra: { effectId: effect.id, attemptCount: effect.attemptCount },
      });
      this.#outbox.markTerminalFailed(effect, cause);
    }
  }

  #readEffectRoom(effect: PendingOutboxEffect): StoredRoomRow {
    assertEffectType(effect);
    const room = this.#repository.readRoom();
    if (room === null) {
      throw new Error(`Room effect ${effect.id} has no room state`);
    }
    if (room.gameType !== effect.gameType) {
      throw new Error(`Game effect ${effect.id} does not match its room`);
    }
    return room;
  }

  #createEffectContext(
    effect: PendingOutboxEffect,
    room: StoredRoomRow,
  ): RuntimeWorkerEffectContext {
    return {
      bindings: this.env,
      effectId: effect.id,
      state: room.state,
      roomIdentity: {
        roomId: this.ctx.id.toString(),
        roomCode: room.roomCode,
        creationId: room.creationId,
      },
      createdRevision: effect.createdRevision,
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
    };
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

  #broadcast(snapshot: RoomSnapshot<BaseGameState<GameType>>, commandType: string | null): void {
    const message = JSON.stringify(createStateUpdateMessage(snapshot, commandType));
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch (error) {
        log.warn('state broadcast skipped closed socket', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  #pushUserEventToConnectedSockets(userId: string, message: object): void {
    const serialized = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets(userSocketTag(userId))) {
      try {
        socket.send(serialized);
      } catch (error) {
        log.warn('unicast skipped closed socket', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async #publishUserEvent(userId: string, eventId: string, message: object): Promise<void> {
    await enqueueUserEvent(this.env.DB, { userId, eventId, message });
    this.#pushUserEventToConnectedSockets(userId, message);
  }

  async #sendNextUserEvent(socket: WebSocket, userId: string): Promise<void> {
    const pending = await readNextUserEvent(this.env.DB, userId);
    if (pending === null) return;
    try {
      socket.send(JSON.stringify(pending.message));
    } catch (error) {
      log.warn('pending user event skipped closed socket', {
        userId,
        eventId: pending.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  #readRoomInstance(identity: RoomInstanceIdentity): ReturnType<RoomRepository['readRoom']> {
    this.#assertIdentityFields(identity);
    const room = this.#repository.readRoom();
    if (room === null) return null;
    if (room.roomCode !== identity.roomCode || room.creationId !== identity.creationId) {
      throw new Error('Room identity does not match Durable Object storage');
    }
    return room;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.#isStorageDeleted) {
      socket.close(1000, 'room_deleted');
      return;
    }
    let acknowledgement;
    try {
      if (typeof message !== 'string') {
        throw new Error('WebSocket client message must be text');
      }
      acknowledgement = parseUserEventAckMessage(JSON.parse(message));
    } catch (error) {
      log.error('invalid websocket client message', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      socket.close(1002, 'protocol_error');
      return;
    }

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

    await acknowledgeUserEvent(this.env.DB, userId, acknowledgement.eventId);
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

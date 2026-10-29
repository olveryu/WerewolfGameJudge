/** Generic room authority: typed RPC dispatch, atomic command pipeline, realtime gateway, outbox drain. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import {
  REASON_NO_STATE,
  REASON_NOT_HOST,
  REASON_ROOM_EFFECTS_PENDING,
} from '@game-judge/game-engine/platform/protocol/reasons';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import * as Sentry from '@sentry/cloudflare';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../../env';
import { type CommandDispatch, CommandPipeline } from '../commands/CommandPipeline';
import { EffectOutbox, OUTBOX_MAX_ATTEMPTS } from '../commands/EffectOutbox';
import { RoomStateStore } from '../commands/RoomStateStore';
import { initializeRoomStorage } from '../commands/storageSchema';
import { createEffectCommandId } from '../gameModules/effectCommandId';
import type {
  RuntimeWorkerGameModule,
  WorkerGameModuleResolver,
} from '../gameModules/runtimeGameModule';
import { createLogger } from '../observability/logger';
import { rejectUpgrade } from '../realtime/rejectUpgrade';
import { RoomGateway } from '../realtime/RoomGateway';
import { enqueueUserEvent } from '../userInbox/inbox';
import type { IGameRoomRPC } from './IGameRoomRPC';
import { handlePlatformRoomEffect, parsePlatformRoomEffect } from './platformEffects';
import { assertRoomEffectDirectory } from './roomDirectory';
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

const log = createLogger('GameRoom');

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

function toRpcResult(dispatch: CommandDispatch): DispatchRoomResult {
  return dispatch.kind === 'unavailable'
    ? dispatch
    : { kind: 'decided', result: dispatch.result, isReplay: dispatch.isReplay };
}

export abstract class GameRoomRuntime extends DurableObject<Env> implements IGameRoomRPC {
  readonly #roomState: RoomStateStore;
  readonly #outbox: EffectOutbox;
  readonly #pipeline: CommandPipeline;
  readonly #gateway: RoomGateway;
  readonly #gameModuleResolver: WorkerGameModuleResolver;
  #isStorageDeleted = false;

  protected abstract resolveGameModule(gameType: GameType): RuntimeWorkerGameModule;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#gameModuleResolver = (gameType) => this.resolveGameModule(gameType);
    this.#roomState = new RoomStateStore(ctx.storage, this.#gameModuleResolver);
    this.#outbox = new EffectOutbox(ctx.storage);
    this.#pipeline = new CommandPipeline({
      storage: ctx.storage,
      roomState: this.#roomState,
      outbox: this.#outbox,
      resolveGameModule: this.#gameModuleResolver,
    });
    this.#gateway = new RoomGateway(ctx, env, {
      readSnapshot: () => (this.#isStorageDeleted ? null : this.#roomState.readSnapshot()),
    });
    void ctx.blockConcurrencyWhile(async () => {
      const initialization = await initializeRoomStorage(ctx.storage, Date.now());
      if (initialization === 'discarded') {
        log.warn('discarded room storage with an unsupported schema', {
          roomId: ctx.id.toString(),
        });
      }
      await this.#scheduleAlarm();
    });
  }

  // ─── RPC ──────────────────────────────────────────────────────────────────

  async initializeRoom(command: InitializeRoomCommand): Promise<InitializeRoomResult> {
    if (this.#isStorageDeleted) {
      throw new Error('Deleted room storage cannot be initialized again');
    }
    this.#readRoomInstance(command);
    return this.#roomState.initialize(command, Date.now());
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

  /** Requeue only effects whose owning game explicitly permits audited recovery. */
  async replayFailedEffect(command: ReplayFailedEffectCommand): Promise<void> {
    const room = this.#readRoomInstance(command);
    if (room === null) throw new Error('Cannot replay an effect without its room');
    if (command.id.trim().length === 0 || command.reason.trim().length === 0) {
      throw new Error('Replay requires a request ID and reason');
    }
    await this.#outbox.replayFailedEffect(
      command.id,
      command.effectId,
      command.reason,
      Date.now(),
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
    return this.#roomState.readSnapshot();
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

    this.#gateway.closeAll(REALTIME_CLOSE_CODE.ROOM_DELETED, 'room_deleted');
    // deleteAll() leaves the alarm armed; an orphaned alarm would wake and re-initialize this object.
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.#isStorageDeleted = true;
    return { success: true };
  }

  // ─── Alarm: presence sweep + outbox drain ─────────────────────────────────

  async alarm(): Promise<void> {
    if (this.#isStorageDeleted) return;
    this.#gateway.sweep(Date.now());
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
          tags: { gameType: claim.effect.gameType, effectType: claim.effect.effectType },
          extra: { effectId: claim.effect.id },
        });
        await this.#terminalizeEffect(claim.effect, exhausted);
        continue;
      }
      const { effect } = claim;
      try {
        await this.#executeEffect(effect);
        this.#outbox.markSucceeded(effect.id, Date.now());
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error));
        log.error('outbox effect failed', {
          effectId: effect.id,
          effectType: effect.effectType,
          attemptCount: effect.attemptCount,
          error: cause.message,
        });
        Sentry.captureException(cause, {
          tags: { gameType: effect.gameType, effectType: effect.effectType },
          extra: { effectId: effect.id, attemptCount: effect.attemptCount },
        });
        if (effect.attemptCount >= OUTBOX_MAX_ATTEMPTS) {
          await this.#terminalizeEffect(effect, cause);
        } else {
          this.#outbox.markFailed(effect, cause, Date.now());
        }
      }
    }
    await this.#scheduleAlarm();
  }

  // ─── WebSocket (Hibernation API) ──────────────────────────────────────────

  /** Admission after the public route authenticated, verified the upgrade and resolved the directory. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/websocket') return new Response('Not Found', { status: 404 });
    if (this.#isStorageDeleted) {
      return rejectUpgrade(REALTIME_CLOSE_CODE.ROOM_DELETED, 'room_deleted');
    }

    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');
    const roomId = url.searchParams.get('roomId');
    const creationId = url.searchParams.get('creationId');
    if (!userId || !roomCode || !roomId || !creationId) {
      throw new Error('Room socket admission requires userId and the full room identity');
    }
    // The directory still points here but this object holds no state for that instance
    // (storage discarded on an unsupported schema, or never initialized): terminal for the client.
    if (this.#readRoomInstance({ roomCode, roomId, creationId }) === null) {
      return rejectUpgrade(REALTIME_CLOSE_CODE.STATE_UNAVAILABLE, 'state_unavailable');
    }

    const pair = new WebSocketPair();
    await this.#gateway.accept(pair[1], userId, Date.now());
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.#isStorageDeleted) {
      socket.close(REALTIME_CLOSE_CODE.ROOM_DELETED, 'room_deleted');
      return;
    }
    this.#gateway.handleMessage(socket, message);
  }

  async webSocketClose(): Promise<void> {
    if (this.#isStorageDeleted) return;
    this.#gateway.handleClose(Date.now());
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    log.warn('websocket error', { error: error instanceof Error ? error.message : String(error) });
    socket.close(1011, 'socket_error');
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  async #dispatchCommand(
    identity: RoomInstanceIdentity,
    command: DispatchRoomCommand,
  ): Promise<DispatchRoomResult> {
    if (this.#isStorageDeleted) return { kind: 'unavailable', reason: REASON_NO_STATE };
    if (this.#readRoomInstance(identity) === null) {
      return { kind: 'unavailable', reason: REASON_NO_STATE };
    }
    return toRpcResult(await this.#runPipeline(command));
  }

  /** Every command path funnels here so broadcasting has exactly one trigger. */
  async #runPipeline(command: DispatchRoomCommand): Promise<CommandDispatch> {
    const dispatch = await this.#pipeline.dispatch(command, Date.now());
    this.#broadcastIfCommitted(dispatch);
    return dispatch;
  }

  #broadcastIfCommitted(dispatch: CommandDispatch): void {
    if (
      dispatch.kind === 'decided' &&
      !dispatch.isReplay &&
      dispatch.shouldBroadcast &&
      dispatch.result.kind === 'committed'
    ) {
      this.#gateway.broadcastState(dispatch.result.snapshot, dispatch.commandType);
    }
  }

  async #terminalizeEffect(effect: PendingOutboxEffect, cause: Error): Promise<void> {
    const commandId = await createEffectCommandId('outbox:terminal-failure', effect.id);
    assertEffectType(effect);
    const room = this.#roomState.read();
    if (room === null || room.gameType !== effect.gameType) {
      throw new Error(`Cannot terminalize effect ${effect.id} without its room`);
    }
    const command =
      effect.scope === 'game'
        ? this.#gameModuleResolver(room.gameType).getEffectFailureCommand(
            effect.payload,
            room.state,
          )
        : null;
    // The failure command and the terminal outbox mark commit together; broadcast only after.
    const dispatched = await this.ctx.storage.transaction(async () => {
      let terminal: CommandDispatch | null = null;
      if (command !== null) {
        terminal = await this.#pipeline.dispatch(
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
          terminal.kind !== 'decided' ||
          terminal.result.kind !== 'committed' ||
          terminal.result.outcome.kind !== 'success'
        ) {
          throw new Error(`Outbox terminal command ${commandId} did not commit successfully`);
        }
      }
      this.#outbox.markFailed(effect, cause, Date.now());
      return terminal;
    });
    if (dispatched !== null) this.#broadcastIfCommitted(dispatched);
  }

  async #executeEffect(effect: PendingOutboxEffect): Promise<void> {
    assertEffectType(effect);
    const room = this.#roomState.read();
    if (room === null) throw new Error(`Room effect ${effect.id} has no room state`);
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

    await this.#gameModuleResolver(room.gameType).handleEffect(effect.payload, {
      bindings: this.env,
      effectId: effect.id,
      state: room.state,
      roomIdentity: directoryIdentity,
      createdRevision: effect.createdRevision,
      deliveryAttemptCount: effect.attemptCount,
      dispatchInternal: async (commandId, command) => {
        const dispatched = await this.#runPipeline({
          roomCode: room.roomCode,
          commandId,
          actor: { kind: 'system', effectId: effect.id },
          controlledSeat: null,
          command,
        });
        if (dispatched.kind !== 'decided') {
          throw new Error(`Internal effect command ${commandId} has no room state`);
        }
        return dispatched.result;
      },
      publishUserEvent: async (userId, eventId, message) => {
        await enqueueUserEvent(this.env.DB, { userId, eventId, message });
        this.#gateway.notifyInbox(userId);
      },
    });
  }

  /** The DO has one alarm; it fires at the earliest of the next outbox effect and the next sweep. */
  async #scheduleAlarm(): Promise<void> {
    const nowMs = Date.now();
    const dueAt = [this.#outbox.readNextAvailableAt(), this.#gateway.nextSweepAt(nowMs)].filter(
      (at): at is number => at !== null,
    );
    if (dueAt.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const nextAt = Math.min(...dueAt);
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (existingAlarm === null || existingAlarm > nextAt) {
      await this.ctx.storage.setAlarm(nextAt);
    }
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
    stored: Pick<RoomInstanceIdentity, 'roomCode' | 'creationId'>,
  ): void {
    if (stored.roomCode !== identity.roomCode || stored.creationId !== identity.creationId) {
      throw new Error('Room identity does not match Durable Object storage');
    }
  }

  #readRoomInitialization(identity: RoomInstanceIdentity) {
    this.#assertIdentityFields(identity);
    const initialization = this.#roomState.readInitialization();
    if (initialization === null) return null;
    this.#assertRoomStorageIdentity(identity, initialization);
    return initialization;
  }

  #readRoomInstance(identity: RoomInstanceIdentity) {
    this.#assertIdentityFields(identity);
    const room = this.#roomState.read();
    if (room === null) return null;
    this.#assertRoomStorageIdentity(identity, room);
    return room;
  }
}

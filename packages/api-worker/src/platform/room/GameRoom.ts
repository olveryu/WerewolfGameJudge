/** Generic room authority: typed RPC dispatch, atomic storage, realtime, and outbox drain. */

import * as Sentry from '@sentry/cloudflare';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { REASON_NO_STATE, REASON_NOT_HOST } from '@werewolf/game-engine/platform/protocol/reasons';
import {
  type BaseGameState,
  createStateUpdateMessage,
  type RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../../env';
import { createLogger } from '../../lib/logger';
import { dispatchRoomCommand } from './actionPipeline';
import { EffectOutbox } from './effectOutbox';
import type { IGameRoomRPC } from './IGameRoomRPC';
import { handlePlatformRoomEffect, parsePlatformRoomEffect } from './platformEffects';
import { getWorkerGameModule, RoomRepository } from './roomRepository';
import { migrateRoomStorage } from './storageSchema';
import type {
  DeleteRoomResult,
  DispatchRoomResult,
  DispatchUserRoomCommand,
  InitializeRoomCommand,
  InitializeRoomResult,
  PendingOutboxEffect,
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

class GameRoomBase extends DurableObject<Env> implements IGameRoomRPC {
  readonly #repository: RoomRepository;
  readonly #outbox: EffectOutbox;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#repository = new RoomRepository(ctx.storage);
    this.#outbox = new EffectOutbox(ctx.storage);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      await migrateRoomStorage(ctx.storage, Date.now());
      await this.#schedulePendingOutbox();
    });
  }

  async initializeRoom(command: InitializeRoomCommand): Promise<InitializeRoomResult> {
    return this.#repository.initialize(command, Date.now());
  }

  async dispatchUserCommand(command: DispatchUserRoomCommand): Promise<DispatchRoomResult> {
    if (command.actorUserId.length === 0) {
      throw new Error('dispatchUserCommand.actorUserId must be non-empty');
    }
    const pipeline = await dispatchRoomCommand(
      this.#repository,
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
      !pipeline.rpc.isReplay &&
      pipeline.rpc.result.kind === 'committed' &&
      pipeline.broadcast === 'state'
    ) {
      this.#broadcast(pipeline.rpc.result.snapshot, pipeline.commandType);
    }
    return pipeline.rpc;
  }

  async getSnapshot(): Promise<RoomSnapshot<BaseGameState<GameType>> | null> {
    return this.#repository.readSnapshot();
  }

  async getRevision(): Promise<number | null> {
    return this.#repository.readRoom()?.revision ?? null;
  }

  async deleteRoom(actorUserId: string): Promise<DeleteRoomResult> {
    const room = this.#repository.readRoom();
    if (room === null) return { success: false, reason: REASON_NO_STATE };
    if (actorUserId !== room.hostUserId) {
      return { success: false, reason: REASON_NOT_HOST };
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    return { success: true };
  }

  async alarm(): Promise<void> {
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
        this.#outbox.markFailed(effect, cause, Date.now());
      }
    }
    await this.#schedulePendingOutbox();
  }

  async #executeEffect(effect: PendingOutboxEffect): Promise<void> {
    assertEffectType(effect);
    if (effect.scope === 'platform') {
      await handlePlatformRoomEffect(effect.id, parsePlatformRoomEffect(effect.payload), this.env);
      return;
    }

    const room = this.#repository.readRoom();
    if (room === null) {
      throw new Error(`Game effect ${effect.id} has no room state`);
    }
    if (room.gameType !== effect.gameType) {
      throw new Error(`Game effect ${effect.id} does not match its room`);
    }
    const module = getWorkerGameModule(room.gameType);
    await module.handleEffect(effect.payload, {
      bindings: this.env,
      effectId: effect.id,
      roomCode: room.roomCode,
      revision: effect.createdRevision,
      dispatchInternal: async (commandId, command) => {
        const dispatched = await dispatchRoomCommand(
          this.#repository,
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
          !dispatched.rpc.isReplay &&
          dispatched.rpc.result.kind === 'committed' &&
          dispatched.broadcast === 'state'
        ) {
          this.#broadcast(dispatched.rpc.result.snapshot, dispatched.commandType);
        }
        return dispatched.rpc.result;
      },
      sendToUser: (userId, message) => this.#sendToUser(userId, message),
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

  #sendToUser(userId: string, message: object): void {
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

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/websocket') {
      return new Response('Not Found', { status: 404 });
    }
    return this.#handleWebSocketUpgrade(url);
  }

  #handleWebSocketUpgrade(url: URL): Response {
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');
    if (userId === null || userId.length === 0 || roomCode === null || roomCode.length === 0) {
      return new Response('userId and roomCode required', { status: 400 });
    }
    const room = this.#repository.readRoom();
    if (room === null) return new Response('Room not initialized', { status: 404 });
    if (room.roomCode !== roomCode) return new Response('Room code mismatch', { status: 409 });

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [userSocketTag(userId)]);
    return new Response(null, { status: 101, webSocket: pair[0] });
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

export const GameRoom = Sentry.instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
  }),
  GameRoomBase,
);

export type GameRoom = InstanceType<typeof GameRoom>;

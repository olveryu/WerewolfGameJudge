/**
 * GameRoomBase — game state authority + WebSocket broadcast.
 *
 * Responsibilities:
 * - One DO instance per room
 * - SQLite persists game_state + revision (single-threaded serialized, zero contention)
 * - Typed RPC methods for Worker handlers to call
 * - WebSocket Hibernation API manages realtime connections + broadcast
 *
 * Not responsible for:
 * - HTTP routing/auth (handled by Worker handler)
 * - D1 room metadata (handled by Worker D1 layer)
 *
 * Boundary constraints:
 * - Worker handler calls DO methods directly via RPC; DO completes read-compute-write-broadcast internally
 * - WebSocket upgrade still goes through fetch() handler (RPC and fetch coexist)
 * - Auto pong: ctx.setWebSocketAutoResponse('ping' → 'pong')
 */

import * as Sentry from '@sentry/cloudflare';
import { handleSubmitAction } from '@werewolf/game-engine/engine/handlers/actionHandler';
import {
  handleAssignRoles,
  handleBoardNominate,
  handleBoardUpvote,
  handleBoardWithdraw,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from '@werewolf/game-engine/engine/handlers/gameControlHandler';
import {
  handleClearAllSeats,
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from '@werewolf/game-engine/engine/handlers/seatHandler';
import { handleSetAudioPlaying } from '@werewolf/game-engine/engine/handlers/stepTransitionHandler';
import { handlerError, handlerSuccess } from '@werewolf/game-engine/engine/handlers/types';
import { handleViewedRole } from '@werewolf/game-engine/engine/handlers/viewedRoleHandler';
import { handleSetWolfRobotHunterStatusViewed } from '@werewolf/game-engine/engine/handlers/wolfRobotHunterGateHandler';
import type {
  StateAction,
  UpdatePlayerProfileAction,
} from '@werewolf/game-engine/engine/reducer/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import type { GameRuleOverrides } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env';
import { type PlayerSettleResult, settleGameResults } from '../growth/settleGameResults';
import { createLogger } from '../lib/logger';
import type { SeatActionParams } from '../schemas/game';

const log = createLogger('GameRoom');
import { ENGINE_REGISTRY } from './engineRegistry';
import {
  buildHandlerContext,
  extractAudioActions,
  type GameActionResult,
  processAction,
} from './gameProcessor';
import type { IGameRoomRPC } from './IGameRoomRPC';
import { type DispatchResult, processEngineAction } from './processEngineAction';

interface WebSocketAttachment {
  userId: string;
  roomCode: string;
  /** Date.now() at WS accept (epoch ms) */
  connectedAt: number;
}

class GameRoomBase extends DurableObject<Env> implements IGameRoomRPC {
  /** Max settle retries */
  static readonly SETTLE_MAX_RETRIES = 3;
  /** Retry interval (ms) */
  static readonly SETTLE_RETRY_DELAY_MS = 30_000;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Auto-reply pong to ping without waking the DO from hibernation
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          game_state TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0
        )
      `);
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  #processAction(
    processFn: Parameters<typeof processAction>[1],
    inlineProgression?: Parameters<typeof processAction>[2],
    lastAction?: string,
  ): GameActionResult {
    const result = processAction(this.ctx.storage.sql, processFn, inlineProgression);

    // Broadcast — output gate ensures send only after write is persisted
    if (result.success && result.state && result.revision != null) {
      const shouldBroadcast = result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;
      if (shouldBroadcast) {
        this.#broadcast(result.state, result.revision, lastAction);
      }
    }

    return result;
  }

  #broadcast(state: unknown, revision: number, lastAction?: string): void {
    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      state,
      revision,
      ...(lastAction && { lastAction }),
    });

    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch {
        // Socket already closed — will be cleaned up in webSocketClose
      }
    }
  }

  /** If game just ended (status === Ended), asynchronously trigger growth settlement */
  #settleIfEnded(result: GameActionResult): void {
    if (result.success && result.state?.status === GameStatus.Ended) {
      const revision = result.revision!;
      this.ctx.waitUntil(
        this.#runSettle(result.state, revision).catch((err) => {
          log.error('settleGameResults failed, scheduling retry', {
            error: err instanceof Error ? err.message : String(err),
          });
          this.#scheduleSettleRetry(revision, 0);
        }),
      );
    }
  }

  /** Run settlement and broadcast results + update roster levels */
  async #runSettle(state: GameState, revision: number): Promise<void> {
    const settleResults = await settleGameResults(state, this.env, revision);
    this.#sendSettleResults(settleResults);
    this.#updateRosterLevels(settleResults);
  }

  /**
   * Schedule alarm to retry settlement.
   * @remarks Retries up to SETTLE_MAX_RETRIES=3 times at SETTLE_RETRY_DELAY_MS=30s intervals.
   *   Gives up and logs error after exhausted.
   */
  #scheduleSettleRetry(revision: number, attempt: number): void {
    if (attempt >= GameRoom.SETTLE_MAX_RETRIES) {
      log.error('settle retries exhausted', { revision, attempt });
      return;
    }
    void this.ctx.storage.put('settle_pending', { revision, attempt });
    void this.ctx.storage.setAlarm(Date.now() + GameRoom.SETTLE_RETRY_DELAY_MS);
  }

  /**
   * DO Alarm callback — retries incomplete settlement.
   * @remarks CF DO guarantees only one alarm is executing at a time (single-threaded).
   *   If state is no longer Ended (already restarted), skip settlement and clear pending flag.
   */
  async alarm(): Promise<void> {
    const pending = await this.ctx.storage.get<{ revision: number; attempt: number }>(
      'settle_pending',
    );
    if (!pending) return;

    const rows = this.ctx.storage.sql
      .exec('SELECT game_state FROM room_state WHERE id = 1')
      .toArray();
    if (rows.length === 0) {
      await this.ctx.storage.delete('settle_pending');
      return;
    }

    const state = JSON.parse(rows[0].game_state as string) as GameState;
    if (state.status !== GameStatus.Ended) {
      await this.ctx.storage.delete('settle_pending');
      return;
    }

    try {
      await this.#runSettle(state, pending.revision);
      await this.ctx.storage.delete('settle_pending');
    } catch (err) {
      log.error('settle retry failed', {
        revision: pending.revision,
        attempt: pending.attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      this.#scheduleSettleRetry(pending.revision, pending.attempt + 1);
    }
  }

  /** After settlement, update roster level via processAction and broadcast */
  #updateRosterLevels(results: PlayerSettleResult[]): void {
    if (results.length === 0) return;

    const levels: Record<string, number> = {};
    for (const r of results) {
      levels[r.userId] = r.newLevel;
    }

    this.#processAction((_state) => {
      return handlerSuccess([{ type: 'UPDATE_ROSTER_LEVELS' as const, payload: { levels } }]);
    });
  }

  /** Unicast settlement result to each connected registered player */
  #sendSettleResults(results: PlayerSettleResult[]): void {
    if (results.length === 0) return;
    const resultByUid = new Map(results.map((r) => [r.userId, r]));
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        const attachment = (
          ws as unknown as { deserializeAttachment(): WebSocketAttachment }
        ).deserializeAttachment();
        const settle = resultByUid.get(attachment.userId);
        if (settle) {
          ws.send(
            JSON.stringify({
              type: 'SETTLE_RESULT',
              xpEarned: settle.xpEarned,
              newXp: settle.newXp,
              newLevel: settle.newLevel,
              previousLevel: settle.previousLevel,
              normalDrawsEarned: settle.normalDrawsEarned,
              goldenDrawsEarned: settle.goldenDrawsEarned,
            }),
          );
        }
      } catch {
        // Socket already closed
      }
    }
  }

  // ── (A) No-arg RPC methods ──────────────────────────────────────────────

  async assignRoles(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        return handleAssignRoles({ type: 'ASSIGN_ROLES' }, ctx);
      },
      undefined,
      'ASSIGN_ROLES',
    );
  }

  async restartGame(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        return handleRestartGame({ type: 'RESTART_GAME' }, ctx);
      },
      undefined,
      'RESTART_GAME',
    );
  }

  async clearAllSeats(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        return handleClearAllSeats({ type: 'CLEAR_ALL_SEATS' }, ctx);
      },
      undefined,
      'CLEAR_ALL_SEATS',
    );
  }

  async fillWithBots(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUserId);
      return handleFillWithBots({ type: 'FILL_WITH_BOTS' }, ctx);
    });
  }

  async markAllBotsViewed(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUserId);
      return handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, ctx);
    });
  }

  // ── (B) Parameterized RPC methods ───────────────────────────────────────

  async seat(params: SeatActionParams): Promise<GameActionResult> {
    const { action, userId } = params;
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, userId);
        if (action === 'sit') {
          return handleJoinSeat(
            {
              type: 'JOIN_SEAT',
              payload: {
                seat: params.seat!,
                userId,
                displayName: params.displayName ?? '',
                avatarUrl: params.avatarUrl,
                avatarFrame: params.avatarFrame,
                seatFlair: params.seatFlair,
                nameStyle: params.nameStyle,
                roleRevealEffect: params.roleRevealEffect,
                seatAnimation: params.seatAnimation,
                level: params.level,
              },
            },
            ctx,
          );
        }
        if (action === 'kick') {
          return handleKickPlayer(
            { type: 'KICK_PLAYER', payload: { targetSeat: params.targetSeat! } },
            ctx,
          );
        }
        return handleLeaveMySeat({ type: 'LEAVE_MY_SEAT', payload: { userId } }, ctx);
      },
      undefined,
      action === 'kick' ? 'KICK_PLAYER' : undefined,
    );
  }

  async submitAction(
    seatNum: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        return handleSubmitAction(
          { type: 'SUBMIT_ACTION', payload: { seat: seatNum, role, target, extra } },
          ctx,
        );
      },
      { enabled: true },
    );
  }

  async viewRole(userId: string, seatNum: number): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, userId);
      return handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat: seatNum } }, ctx);
    });
  }

  async updateTemplate(
    templateRoles: RoleId[],
    rules?: GameRuleOverrides,
  ): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUserId);
      return handleUpdateTemplate(
        { type: 'UPDATE_TEMPLATE', payload: { templateRoles, rules } },
        ctx,
      );
    });
  }

  async updateProfile(payload: UpdatePlayerProfileAction['payload']): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, payload.userId);
      return handleUpdatePlayerProfile({ type: 'UPDATE_PLAYER_PROFILE', payload }, ctx);
    });
  }

  async shareReview(allowedSeats: number[]): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUserId);
      return handleShareNightReview({ type: 'SHARE_NIGHT_REVIEW', allowedSeats }, ctx);
    });
  }

  // ── (D) Board Nomination RPC methods ────────────────────────────────────

  async boardNominate(
    userId: string,
    displayName: string,
    roles: RoleId[],
  ): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, userId);
      return handleBoardNominate(
        { type: 'BOARD_NOMINATE', payload: { userId, displayName, roles } },
        ctx,
      );
    });
  }

  async boardUpvote(voterUid: string, targetUserId: string): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, voterUid);
      return handleBoardUpvote({ type: 'BOARD_UPVOTE', payload: { targetUserId, voterUid } }, ctx);
    });
  }

  async boardWithdraw(userId: string): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, userId);
      return handleBoardWithdraw({ type: 'BOARD_WITHDRAW', payload: { userId } }, ctx);
    });
  }

  // ── (C) Night RPC methods with post-processing ──────────────────────────

  async startNight(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        const result = handleStartNight({ type: 'START_NIGHT' }, ctx);
        if (result.kind === 'error') return result;

        const extraActions = extractAudioActions(result.sideEffects);
        if (extraActions.length > 0) {
          return handlerSuccess([...result.actions, ...extraActions], result.sideEffects);
        }
        return result;
      },
      undefined,
      'START_NIGHT',
    );
  }

  async audioAck(): Promise<GameActionResult> {
    const result = this.#processAction(
      (state) => {
        if (
          !state.isAudioPlaying &&
          (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
        ) {
          return handlerSuccess([]);
        }
        return handlerSuccess([
          { type: 'CLEAR_PENDING_AUDIO_EFFECTS' as const },
          { type: 'SET_AUDIO_PLAYING' as const, payload: { isPlaying: false } },
        ]);
      },
      { enabled: true },
    );
    this.#settleIfEnded(result);
    return result;
  }

  async audioGate(isPlaying: boolean): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUserId);
      return handleSetAudioPlaying({ type: 'SET_AUDIO_PLAYING', payload: { isPlaying } }, ctx);
    });
  }

  async progression(): Promise<GameActionResult> {
    const result = this.#processAction(
      (state) => {
        if (state.status !== GameStatus.Ongoing) {
          return handlerError('not_ongoing');
        }
        return handlerSuccess([]);
      },
      { enabled: true },
    );
    // Settlement is triggered by the last audioAck (after audio finishes); do not settle here
    return result;
  }

  async revealAck(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        if (!state.pendingRevealAcks || state.pendingRevealAcks.length === 0) {
          return handlerError('no_pending_acks');
        }
        return handlerSuccess(
          [{ type: 'CLEAR_REVEAL_ACKS' as const }],
          [{ type: 'BROADCAST_STATE' as const }],
        );
      },
      { enabled: true },
    );
  }

  async wolfRobotViewed(seatNum: number): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUserId);
        return handleSetWolfRobotHunterStatusViewed(ctx, {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: seatNum,
        });
      },
      { enabled: true },
    );
  }

  async groupConfirmAck(seatNum: number, userId: string): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        if (state.status !== GameStatus.Ongoing) {
          return handlerError('not_ongoing');
        }
        const stepId = state.currentStepId;
        if (!stepId) return handlerError('no_current_step');
        const schema = SCHEMAS[stepId];
        if (!schema || schema.kind !== 'groupConfirm') {
          return handlerError('not_group_confirm_step');
        }
        const player = state.players[seatNum];
        if (!player) return handlerError('no_player_at_seat');
        if (player.userId !== userId && userId !== state.hostUserId) {
          return handlerError('userId_mismatch');
        }

        const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
        const isCupidLoversReveal = stepId === 'cupidLoversReveal';
        const acks = isConversionReveal
          ? (state.conversionRevealAcks ?? [])
          : isCupidLoversReveal
            ? (state.cupidLoversRevealAcks ?? [])
            : (state.piperRevealAcks ?? []);
        if (acks.includes(seatNum)) return handlerSuccess([]);

        const actions: StateAction[] = isConversionReveal
          ? [{ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat: seatNum } }]
          : isCupidLoversReveal
            ? [{ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat: seatNum } }]
            : [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat: seatNum } }];

        return handlerSuccess(actions);
      },
      { enabled: true },
    );
  }

  async markBotsGroupConfirmed(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        if (!state.debugMode?.botsEnabled) {
          return handlerError('debug_not_enabled');
        }
        if (state.status !== GameStatus.Ongoing) {
          return handlerError('not_ongoing');
        }
        const stepId = state.currentStepId;
        if (!stepId) return handlerError('no_current_step');
        const schema = SCHEMAS[stepId];
        if (!schema || schema.kind !== 'groupConfirm') {
          return handlerError('not_group_confirm_step');
        }

        const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
        const isCupidLoversReveal = stepId === 'cupidLoversReveal';
        const existingAcks = isConversionReveal
          ? (state.conversionRevealAcks ?? [])
          : isCupidLoversReveal
            ? (state.cupidLoversRevealAcks ?? [])
            : (state.piperRevealAcks ?? []);

        const actions: StateAction[] = [];
        for (const [seatStr, player] of Object.entries(state.players)) {
          if (!player?.isBot) continue;
          const seat = Number.parseInt(seatStr, 10);
          if (existingAcks.includes(seat)) continue;

          if (isConversionReveal) {
            actions.push({ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } });
          } else if (isCupidLoversReveal) {
            actions.push({ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } });
          } else {
            actions.push({ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } });
          }
        }

        return handlerSuccess(actions);
      },
      { enabled: true },
    );
  }

  // ── (D) Read-only RPC methods ───────────────────────────────────────────

  async getState(): Promise<{ state: GameState; revision: number } | null> {
    const rows = this.ctx.storage.sql
      .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
      .toArray();
    if (rows.length === 0) return null;
    return {
      state: JSON.parse(rows[0].game_state as string) as GameState,
      revision: rows[0].revision as number,
    };
  }

  async getRevision(): Promise<number | null> {
    const rows = this.ctx.storage.sql
      .exec('SELECT revision FROM room_state WHERE id = 1')
      .toArray();
    return rows.length > 0 ? (rows[0].revision as number) : null;
  }

  // ── (E) Lifecycle RPC methods ───────────────────────────────────────────

  async init(initialState: GameState): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO room_state (id, game_state, revision) VALUES (1, ?, 1)',
      JSON.stringify(initialState),
    );
  }

  // ── Generic engine path (game-agnostic; selected by engine_type) ────────

  /**
   * Initialize a room for a registered engine (fibking, …).
   * Stores the engine-built initial blob + records engine_type for dispatch routing.
   * Werewolf keeps using `init` above; this path never touches werewolf bespoke logic.
   */
  async initState(engineType: string, blob: unknown): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO room_state (id, game_state, revision) VALUES (1, ?, 1)',
      JSON.stringify(blob),
    );
    await this.ctx.storage.put('engine_type', engineType);
  }

  /**
   * Dispatch an action to the room's engine (read-compute-write-broadcast).
   * Resolves the engine by stored engine_type; unknown engine/action fail fast.
   */
  async dispatch(actionType: string, payload: unknown): Promise<DispatchResult> {
    const engineType = await this.ctx.storage.get<string>('engine_type');
    if (!engineType) return { success: false, reason: 'ENGINE_NOT_INITIALIZED' };
    const engine = ENGINE_REGISTRY[engineType];
    if (!engine) return { success: false, reason: `UNKNOWN_ENGINE:${engineType}` };

    const result = processEngineAction(this.ctx.storage.sql, engine, (state, revision) =>
      engine.dispatch(state, revision, { actionType, payload }),
    );

    if (result.success && result.state !== undefined && result.revision != null) {
      this.#broadcast(result.state, result.revision, actionType);
    }
    return result;
  }

  async cleanup(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  // ── WebSocket fetch handler (coexists with RPC) ─────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      return this.#handleWebSocketUpgrade(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  #handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');

    if (!userId || !roomCode) {
      return new Response('userId and roomCode required', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const attachment: WebSocketAttachment = {
      userId,
      roomCode,
      connectedAt: Date.now(),
    };

    this.ctx.acceptWebSocket(server, [roomCode]);
    (server as unknown as { serializeAttachment(a: unknown): void }).serializeAttachment(
      attachment,
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // ── Hibernation API callbacks ───────────────────────────────────────────

  // No webSocketMessage handler: the only client → server message is the literal
  // 'ping' keepalive, answered at the edge by setWebSocketAutoResponse without
  // waking the DO. All game intents go over HTTP, not the socket.

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    ws.close();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close();
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

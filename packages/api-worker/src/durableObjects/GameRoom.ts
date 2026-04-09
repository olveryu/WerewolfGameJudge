/**
 * GameRoom Durable Object — 游戏状态权威 + WebSocket 广播
 *
 * 每个房间对应一个 DO 实例，负责：
 * 1. SQLite 持久化 game_state + revision（单线程序列化，零竞争）
 * 2. Typed RPC 方法供 Worker handler 调用（替代旧 D1 optimistic lock）
 * 3. WebSocket Hibernation API 管理实时连接 + 广播
 *
 * Worker handler 通过 RPC 直接调用 DO 方法，DO 内部完成读-算-写-广播。
 * WebSocket upgrade 仍走 fetch() handler（RPC 与 fetch 共存）。
 */

import { handleSubmitAction } from '@werewolf/game-engine/engine/handlers/actionHandler';
import {
  handleAssignRoles,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetRoleRevealAnimation,
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
import {
  handleEndNight,
  handleSetAudioPlaying,
} from '@werewolf/game-engine/engine/handlers/stepTransitionHandler';
import { handlerError, handlerSuccess } from '@werewolf/game-engine/engine/handlers/types';
import { handleViewedRole } from '@werewolf/game-engine/engine/handlers/viewedRoleHandler';
import { handleSetWolfRobotHunterStatusViewed } from '@werewolf/game-engine/engine/handlers/wolfRobotHunterGateHandler';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec/schemas';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env';
import {
  buildHandlerContext,
  extractAudioActions,
  type GameActionResult,
  processAction,
} from './gameProcessor';

interface WebSocketAttachment {
  userId: string;
  roomCode: string;
  connectedAt: number;
}

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
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
    ...args: Parameters<typeof processAction> extends [infer _First, ...infer Rest] ? Rest : never
  ): GameActionResult {
    const result = processAction(this.ctx.storage.sql, ...args);

    // 广播 — output gate 保证 write 持久化后才发送
    if (result.state && result.revision != null) {
      const shouldBroadcast = result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;
      if (shouldBroadcast) {
        this.#broadcast(result.state, result.revision);
      }
    }

    return result;
  }

  #broadcast(state: GameState, revision: number): void {
    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      state,
      revision,
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

  // ── (A) No-arg RPC methods ──────────────────────────────────────────────

  async assignRoles(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleAssignRoles({ type: 'ASSIGN_ROLES' }, ctx);
    });
  }

  async restartGame(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleRestartGame({ type: 'RESTART_GAME' }, ctx);
    });
  }

  async clearAllSeats(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleClearAllSeats({ type: 'CLEAR_ALL_SEATS' }, ctx);
    });
  }

  async fillWithBots(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleFillWithBots({ type: 'FILL_WITH_BOTS' }, ctx);
    });
  }

  async markAllBotsViewed(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, ctx);
    });
  }

  // ── (B) Parameterized RPC methods ───────────────────────────────────────

  async seat(
    action: 'sit' | 'standup' | 'kick',
    uid: string,
    seatNum: number | null,
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
    targetSeat?: number,
  ): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, uid);
      if (action === 'sit') {
        return handleJoinSeat(
          {
            type: 'JOIN_SEAT',
            payload: {
              seat: seatNum!,
              uid,
              displayName: displayName ?? '',
              avatarUrl,
              avatarFrame,
            },
          },
          ctx,
        );
      }
      if (action === 'kick') {
        return handleKickPlayer({ type: 'KICK_PLAYER', payload: { targetSeat: targetSeat! } }, ctx);
      }
      return handleLeaveMySeat({ type: 'LEAVE_MY_SEAT', payload: { uid } }, ctx);
    });
  }

  async submitAction(
    seatNum: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        const ctx = buildHandlerContext(state, state.hostUid);
        return handleSubmitAction(
          { type: 'SUBMIT_ACTION', payload: { seat: seatNum, role, target, extra } },
          ctx,
        );
      },
      { enabled: true },
    );
  }

  async setAnimation(animation: string): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleSetRoleRevealAnimation(
        { type: 'SET_ROLE_REVEAL_ANIMATION', animation: animation as RoleRevealAnimation },
        ctx,
      );
    });
  }

  async viewRole(uid: string, seatNum: number): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, uid);
      return handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat: seatNum } }, ctx);
    });
  }

  async updateTemplate(templateRoles: RoleId[]): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleUpdateTemplate({ type: 'UPDATE_TEMPLATE', payload: { templateRoles } }, ctx);
    });
  }

  async updateProfile(
    uid: string,
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
  ): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, uid);
      return handleUpdatePlayerProfile(
        {
          type: 'UPDATE_PLAYER_PROFILE',
          payload: { uid, displayName, avatarUrl, avatarFrame },
        },
        ctx,
      );
    });
  }

  async shareReview(allowedSeats: number[]): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleShareNightReview({ type: 'SHARE_NIGHT_REVIEW', allowedSeats }, ctx);
    });
  }

  // ── (C) Night RPC methods with post-processing ──────────────────────────

  async startNight(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      const result = handleStartNight({ type: 'START_NIGHT' }, ctx);
      if (result.kind === 'error') return result;

      const extraActions = extractAudioActions(result.sideEffects);
      if (extraActions.length > 0) {
        return handlerSuccess([...result.actions, ...extraActions], result.sideEffects);
      }
      return result;
    });
  }

  async endNight(): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      const result = handleEndNight({ type: 'END_NIGHT' }, ctx);
      if (result.kind === 'error') return result;

      const extraActions = extractAudioActions(result.sideEffects);
      if (extraActions.length > 0) {
        return handlerSuccess([...result.actions, ...extraActions], result.sideEffects);
      }
      return result;
    });
  }

  async audioAck(): Promise<GameActionResult> {
    return this.#processAction(
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
  }

  async audioGate(isPlaying: boolean): Promise<GameActionResult> {
    return this.#processAction((state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleSetAudioPlaying({ type: 'SET_AUDIO_PLAYING', payload: { isPlaying } }, ctx);
    });
  }

  async progression(): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        if (state.status !== GameStatus.Ongoing) {
          return handlerError('not_ongoing');
        }
        return handlerSuccess([]);
      },
      { enabled: true },
    );
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
        const ctx = buildHandlerContext(state, state.hostUid);
        return handleSetWolfRobotHunterStatusViewed(ctx, {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: seatNum,
        });
      },
      { enabled: true },
    );
  }

  async groupConfirmAck(seatNum: number, uid: string): Promise<GameActionResult> {
    return this.#processAction(
      (state) => {
        if (state.status !== GameStatus.Ongoing) {
          return handlerError('not_ongoing');
        }
        const stepId = state.currentStepId;
        if (!stepId) return handlerError('no_current_step');
        const schema = SCHEMAS[stepId as SchemaId];
        if (!schema || schema.kind !== 'groupConfirm') {
          return handlerError('not_group_confirm_step');
        }
        const player = state.players[seatNum];
        if (!player) return handlerError('no_player_at_seat');
        if (player.uid !== uid && uid !== state.hostUid) {
          return handlerError('uid_mismatch');
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
        const schema = SCHEMAS[stepId as SchemaId];
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
      state: JSON.parse(rows[0].game_state as string),
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

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message);

    try {
      const parsed = JSON.parse(data);

      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {
      // Non-JSON message — ignore
    }
  }

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

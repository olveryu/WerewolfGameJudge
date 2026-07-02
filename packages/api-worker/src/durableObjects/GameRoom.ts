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
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env';
import { createLogger } from '../lib/logger';
import { runEngineAlarm, runEnginePostCommitEffects } from './effects/engineEffectRegistry';
import type { EngineEffectContext } from './effects/types';
import { getRegisteredEngine } from './engineRegistry';
import type { IGameRoomRPC } from './IGameRoomRPC';
import { type DispatchResult, processEngineAction } from './processEngineAction';
import type { WebSocketAttachment } from './webSocketAttachment';

const log = createLogger('GameRoom');

class GameRoomBase extends DurableObject<Env> implements IGameRoomRPC {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Auto-reply pong to ping without waking the DO from hibernation
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        game_state TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  #broadcast(state: unknown, revision: number, lastAction?: string): void {
    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      state,
      revision,
      ...(lastAction && { lastAction }),
    });

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch (err) {
        log.warn('broadcast send failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  #effectContext(): EngineEffectContext {
    return {
      storage: this.ctx.storage,
      env: this.env,
      getWebSockets: () => this.ctx.getWebSockets(),
      broadcast: (state: unknown, revision: number, lastAction?: string) =>
        this.#broadcast(state, revision, lastAction),
    };
  }

  #resolveBroadcastAction(
    actionType: string,
    broadcastAction: string | null | undefined,
  ): string | undefined {
    if (broadcastAction === null) return undefined;
    return broadcastAction ?? actionType;
  }

  #parseStateJson(value: unknown): unknown {
    if (typeof value !== 'string') {
      throw new Error('[FAIL-FAST] room_state.game_state must be a JSON string');
    }
    return JSON.parse(value);
  }

  #parseRevision(value: unknown): number {
    if (typeof value !== 'number') {
      throw new Error('[FAIL-FAST] room_state.revision must be a number');
    }
    return value;
  }

  async alarm(): Promise<void> {
    const gameType = await this.ctx.storage.get<string>('game_type');
    if (!gameType) {
      throw new Error('[FAIL-FAST] GameRoom alarm requires initialized game_type');
    }
    await runEngineAlarm(gameType, this.#effectContext());
  }

  // ── Read-only RPC methods ───────────────────────────────────────────────

  async getState(): Promise<{ state: unknown; revision: number } | null> {
    const rows = this.ctx.storage.sql
      .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
      .toArray();
    if (rows.length === 0) return null;
    return {
      state: this.#parseStateJson(rows[0].game_state),
      revision: this.#parseRevision(rows[0].revision),
    };
  }

  async getRevision(): Promise<number | null> {
    const rows = this.ctx.storage.sql
      .exec('SELECT revision FROM room_state WHERE id = 1')
      .toArray();
    return rows.length > 0 ? this.#parseRevision(rows[0].revision) : null;
  }

  // ── (E) Lifecycle RPC methods ───────────────────────────────────────────

  // ── Registered game state ───────────────────────────────────────────────

  /**
   * Initialize a room for a gameType.
   * Stores the server-built initial blob + records game_type for routing.
   */
  async initState(gameType: string, blob: unknown): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO room_state (id, game_state, revision) VALUES (1, ?, 1)',
      JSON.stringify(blob),
    );
    await this.ctx.storage.put('game_type', gameType);
  }

  /**
   * Dispatch an action to the room's engine (read-compute-write-broadcast).
   * Resolves the engine by stored game_type; unknown game/action fail fast.
   */
  async engineAction(actionType: string, payload: unknown): Promise<DispatchResult> {
    const gameType = await this.ctx.storage.get<string>('game_type');
    if (!gameType) return { success: false, reason: 'GAME_NOT_INITIALIZED' };
    const engine = getRegisteredEngine(gameType);
    if (!engine) return { success: false, reason: `UNKNOWN_GAME_TYPE:${gameType}` };

    const trigger = { actionType, payload };
    const result = processEngineAction(this.ctx.storage.sql, engine, trigger);

    if (result.state !== undefined && result.revision != null) {
      const shouldBroadcast = result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;
      if (shouldBroadcast) {
        this.#broadcast(
          result.state,
          result.revision,
          this.#resolveBroadcastAction(actionType, result.broadcastAction),
        );
      }
    }
    await runEnginePostCommitEffects(gameType, result, {
      ...this.#effectContext(),
      trigger,
    });
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
    server.serializeAttachment(attachment);

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

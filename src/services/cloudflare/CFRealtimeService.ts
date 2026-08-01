/**
 * CFRealtimeService — Cloudflare DO WebSocket transport layer.
 *
 * Responsibilities:
 * - Implements the IRealtimeTransport interface
 * - URL construction (roomCode + token → ws:// URL)
 * - WebSocket creation + 8s connection timeout
 * - Message parsing (STATE_UPDATE / pong / settle_result)
 * - Fires typed events upward (onOpen / onClose / onError / onStateUpdate / onPong)
 *
 * Not responsible for:
 * - Reconnect logic, ping timer, state management, platform event listeners
 * - All of the above are managed by ConnectionManager
 *
 * Boundary constraints:
 * - generation counter prevents stale WS event leaks after disconnect/reconnect
 * - Connection timeout is controlled by WS_CONNECT_TIMEOUT_MS (8s)
 */

import {
  parseRoomLocator,
  type RoomLocator,
} from '@game-judge/game-engine/platform/protocol/roomLocator';
import {
  type BaseGameState,
  type GameStateCodec,
  parseStateUpdateMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { API_BASE_URL } from '@/config/api';
import type {
  IRealtimeTransport,
  RealtimeUserEvent,
  RealtimeUserEventCodec,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';
import { handleError } from '@/utils/errorPipeline';
import { realtimeLog } from '@/utils/logger';

import { ensureFreshToken } from './cfFetch';

/** WebSocket connection timeout (ms) */
const WS_CONNECT_TIMEOUT_MS = 8_000;

/**
 * CFRealtimeService — WebSocket transport layer implementation.
 *
 * Responsibilities: URL construction, WS creation/teardown, message parsing, connection timeout.
 * Does not include reconnect/backoff logic.
 */
export class CFRealtimeService<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent,
> implements IRealtimeTransport<TState, TEvent> {
  #ws: WebSocket | null = null;
  #handlers: TransportEventHandlers<TState, TEvent> | null = null;
  readonly #stateCodec: GameStateCodec<TState>;
  readonly #userEventCodec: RealtimeUserEventCodec<TEvent>;
  /** Generation counter: prevents stale WS events after disconnect/reconnect */
  #generation = 0;
  #lastSocketRevision = 0;

  constructor(stateCodec: GameStateCodec<TState>, userEventCodec: RealtimeUserEventCodec<TEvent>) {
    this.#stateCodec = stateCodec;
    this.#userEventCodec = userEventCodec;
  }

  setEventHandlers(handlers: TransportEventHandlers<TState, TEvent>): void {
    this.#handlers = handlers;
  }

  #requireHandlers(): TransportEventHandlers<TState, TEvent> {
    if (!this.#handlers) {
      throw new Error('CFRealtimeService requires event handlers before connect');
    }
    return this.#handlers;
  }

  /**
   * Open a new room socket after invalidating every event from the previous generation.
   * setEventHandlers() must be called before connect().
   */
  async connect(room: RoomLocator): Promise<void> {
    this.#requireHandlers();
    // Close any existing connection first (silent, no event)
    this.#closeWsSilent();

    const generation = ++this.#generation;
    this.#lastSocketRevision = 0;
    // The WS handshake cannot surface a 401 to the cfFetch refresh interceptor,
    // so an expired token would loop (401 → close → retry with the same stale token).
    // Refresh the token up-front, then open the socket.
    await this.#openSocket(
      parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId }),
      generation,
    );
  }

  async #openSocket(room: RoomLocator, generation: number): Promise<void> {
    const token = await ensureFreshToken();
    // A newer connect()/disconnect() superseded us while refreshing → abort.
    if (generation !== this.#generation) return;
    if (!token) {
      throw new Error('Transport cannot connect without a valid access token');
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws?roomCode=${encodeURIComponent(room.roomCode)}&roomId=${encodeURIComponent(room.roomId)}&token=${encodeURIComponent(token)}`;

    realtimeLog.info('Transport: connecting', room);
    const ws = new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
      if (generation !== this.#generation) return;
      realtimeLog.warn('Transport: connection timeout');
      ws.close();
      // onclose will fire and notify handler
    }, WS_CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (generation !== this.#generation) {
        ws.close();
        return;
      }
      clearTimeout(timeout);
      this.#ws = ws;
      realtimeLog.info('Transport: WebSocket open', room);
      this.#requireHandlers().onOpen();
    };

    ws.onmessage = (event) => {
      if (generation !== this.#generation) return;
      // Heartbeat pong arrives as the literal string "pong" via the DO's
      // setWebSocketAutoResponse, so it never reaches #parseMessage (JSON path).
      if (event.data === 'pong') {
        this.#requireHandlers().onPong();
        return;
      }
      this.#parseMessage(event, ws);
    };

    ws.onclose = (event) => {
      if (generation !== this.#generation) return;
      clearTimeout(timeout);
      if (this.#ws === ws) {
        this.#ws = null;
      }
      // warn (not info): the close code is the key diagnostic for WeChat WebView drops
      // (1001 = backgrounded, 1006 = abnormal/network, 1000 = normal).
      realtimeLog.warn('Transport: WebSocket closed', {
        code: event.code,
        reason: event.reason,
      });
      this.#requireHandlers().onClose(event.code, event.reason);
    };

    ws.onerror = () => {
      if (generation !== this.#generation) return;
      clearTimeout(timeout);
      // Detail-less and always followed by onclose (which carries the code) → debug only.
      realtimeLog.debug('Transport: WebSocket error');
      this.#requireHandlers().onError(new Error('WebSocket error'));
    };
  }

  disconnect(): void {
    this.#closeWsSilent();
  }

  send(data: string): boolean {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(data);
      return true;
    } else {
      realtimeLog.warn('Transport: send dropped (WS not open)', {
        readyState: this.#ws?.readyState,
      });
      return false;
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Close WS without triggering event handlers.
   * Used by disconnect() and connect() (to clean up before new connection).
   */
  #closeWsSilent(): void {
    this.#generation++;
    if (this.#ws) {
      const ws = this.#ws;
      this.#ws = null;
      try {
        ws.close();
      } catch (error) {
        realtimeLog.warn('Transport: failed to close WebSocket', { error });
      }
    }
  }

  #parseMessage(event: MessageEvent, ws: WebSocket): void {
    try {
      if (typeof event.data !== 'string') {
        throw new Error('Realtime protocol message must be text');
      }
      const data: unknown = JSON.parse(event.data);
      if (!isWsObject(data)) {
        throw new Error('Realtime protocol message must contain a string type');
      }

      if (data.type === 'STATE_UPDATE') {
        const message = parseStateUpdateMessage(data, this.#stateCodec);
        if (message.revision <= this.#lastSocketRevision) {
          throw new Error(
            `STATE_UPDATE revision ${message.revision} did not advance from ${this.#lastSocketRevision}`,
          );
        }
        this.#lastSocketRevision = message.revision;
        realtimeLog.debug('Transport: STATE_UPDATE', { revision: message.revision });
        this.#requireHandlers().onStateUpdate(message);
      } else {
        this.#requireHandlers().onUserEvent(this.#userEventCodec.parse(data));
      }
    } catch (error) {
      handleError(error, {
        label: '实时协议',
        logger: realtimeLog,
        feedback: false,
      });
      this.#requireHandlers().onError(error);
      ws.close(1002, 'protocol_error');
    }
  }
}

/** Type guard: parsed JSON is a non-null object with a string `type` field. */
function isWsObject(data: unknown): data is Record<string, unknown> & { type: string } {
  return isRecord(data) && typeof data.type === 'string';
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

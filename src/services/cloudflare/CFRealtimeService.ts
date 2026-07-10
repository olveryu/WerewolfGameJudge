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
  type GameStateCodec,
  parseStateUpdateMessage,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { API_BASE_URL } from '@/config/api';
import type {
  IRealtimeTransport,
  SettleResultMessage,
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
export class CFRealtimeService implements IRealtimeTransport {
  #ws: WebSocket | null = null;
  #handlers: TransportEventHandlers | null = null;
  readonly #stateCodec: GameStateCodec<GameState>;
  /** Generation counter: prevents stale WS events after disconnect/reconnect */
  #generation = 0;

  constructor(stateCodec: GameStateCodec<GameState>) {
    this.#stateCodec = stateCodec;
  }

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.#handlers = handlers;
  }

  #requireHandlers(): TransportEventHandlers {
    if (!this.#handlers) {
      throw new Error('CFRealtimeService requires event handlers before connect');
    }
    return this.#handlers;
  }

  /**
   * Open a new room socket after invalidating every event from the previous generation.
   * setEventHandlers() must be called before connect().
   */
  connect(roomCode: string, _userId: string): void {
    this.#requireHandlers();
    // Close any existing connection first (silent, no event)
    this.#closeWsSilent();

    const generation = ++this.#generation;
    // The WS handshake cannot surface a 401 to the cfFetch refresh interceptor,
    // so an expired token would loop (401 → close → retry with the same stale token).
    // Refresh the token up-front, then open the socket.
    void this.#openSocket(roomCode, generation);
  }

  async #openSocket(roomCode: string, generation: number): Promise<void> {
    const token = await ensureFreshToken();
    // A newer connect()/disconnect() superseded us while refreshing → abort.
    if (generation !== this.#generation) return;
    if (!token) {
      realtimeLog.warn('Transport: no valid token, aborting WS connect');
      this.#requireHandlers().onClose(4001, 'no valid token');
      return;
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws?roomCode=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`;

    realtimeLog.info('Transport: connecting', { roomCode });
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
      realtimeLog.info('Transport: WebSocket open', { roomCode });
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

  send(data: string): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(data);
    } else {
      realtimeLog.warn('Transport: send dropped (WS not open)', {
        readyState: this.#ws?.readyState,
      });
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
        realtimeLog.debug('Transport: STATE_UPDATE', { revision: message.revision });
        this.#requireHandlers().onStateUpdate(message);
      } else if (data.type === 'SETTLE_RESULT') {
        this.#requireHandlers().onSettleResult(parseSettleResultMessage(data));
      } else {
        throw new Error(`Unsupported realtime message type: ${data.type}`);
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
  return typeof data === 'object' && data !== null;
}

function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  return value;
}

function parseSettleResultMessage(
  data: Record<string, unknown> & { type: string },
): SettleResultMessage {
  return {
    xpEarned: requireNumber(data.xpEarned, 'SETTLE_RESULT.xpEarned'),
    newXp: requireNumber(data.newXp, 'SETTLE_RESULT.newXp'),
    newLevel: requireNumber(data.newLevel, 'SETTLE_RESULT.newLevel'),
    previousLevel: requireNumber(data.previousLevel, 'SETTLE_RESULT.previousLevel'),
    normalDrawsEarned: requireNumber(data.normalDrawsEarned, 'SETTLE_RESULT.normalDrawsEarned'),
    goldenDrawsEarned: requireNumber(data.goldenDrawsEarned, 'SETTLE_RESULT.goldenDrawsEarned'),
  };
}

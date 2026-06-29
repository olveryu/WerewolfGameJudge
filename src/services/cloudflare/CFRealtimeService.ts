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

import type { GameState } from '@werewolf/game-engine/protocol/types';

import { API_BASE_URL } from '@/config/api';
import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';
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
  /** Generation counter: prevents stale WS events after disconnect/reconnect */
  #generation = 0;

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.#handlers = handlers;
  }

  /**\n   * @pre setEventHandlers() \u5df2\u8c03\u7528\u3002\n   * @remarks generation counter \u9632\u6b62 stale WS \u4e8b\u4ef6\u6cc4\u6f0f\uff1a\u6bcf\u6b21 connect() \u9012\u589e #generation\uff0c\n   *   \u4e8b\u4ef6 handler \u4e2d\u68c0\u67e5 `if (gen !== this.#generation) return;` \u4e22\u5f03\u65e7\u8fde\u63a5\u4e8b\u4ef6\u3002\n   *   \u8fde\u63a5\u8d85\u65f6 = WS_CONNECT_TIMEOUT_MS (8s)\uff0c\u8d85\u65f6\u540e\u4e3b\u52a8 close WS\u3002\n   */
  connect(roomCode: string, _userId: string): void {
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
      this.#handlers?.onClose(4001, 'no valid token');
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
      this.#handlers?.onOpen();
    };

    ws.onmessage = (event) => {
      if (generation !== this.#generation) return;
      // Heartbeat pong arrives as the literal string "pong" via the DO's
      // setWebSocketAutoResponse, so it never reaches #parseMessage (JSON path).
      if (event.data === 'pong') {
        this.#handlers?.onPong();
        return;
      }
      this.#parseMessage(event);
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
      this.#handlers?.onClose(event.code, event.reason);
    };

    ws.onerror = () => {
      if (generation !== this.#generation) return;
      clearTimeout(timeout);
      // Detail-less and always followed by onclose (which carries the code) → debug only.
      realtimeLog.debug('Transport: WebSocket error');
      this.#handlers?.onError(new Error('WebSocket error'));
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
      } catch {
        // Ignore close errors
      }
    }
  }

  #parseMessage(event: MessageEvent): void {
    try {
      const data: unknown = JSON.parse(event.data as string);
      if (!isWsObject(data)) return;

      if (data.type === 'STATE_UPDATE' && 'state' in data && 'revision' in data) {
        const { state, revision, lastAction } = data as {
          state: GameState;
          revision: number;
          lastAction?: string;
        };
        realtimeLog.debug('Transport: STATE_UPDATE', { revision });
        this.#handlers?.onStateUpdate(state, revision, lastAction);
      } else if (data.type === 'SETTLE_RESULT') {
        const d = data as Record<string, unknown>;
        if (
          typeof d.xpEarned === 'number' &&
          typeof d.newXp === 'number' &&
          typeof d.newLevel === 'number' &&
          typeof d.previousLevel === 'number'
        ) {
          this.#handlers?.onSettleResult({
            xpEarned: d.xpEarned,
            newXp: d.newXp,
            newLevel: d.newLevel,
            previousLevel: d.previousLevel,
            normalDrawsEarned: typeof d.normalDrawsEarned === 'number' ? d.normalDrawsEarned : 0,
            goldenDrawsEarned: typeof d.goldenDrawsEarned === 'number' ? d.goldenDrawsEarned : 0,
          });
        }
      }
    } catch {
      realtimeLog.warn('Transport: failed to parse WS message');
    }
  }
}

/** Type guard: parsed JSON is a non-null object with a string `type` field. */
function isWsObject(data: unknown): data is { type: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as Record<string, unknown>).type === 'string'
  );
}

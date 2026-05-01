/**
 * CFRealtimeService — Cloudflare Durable Objects WebSocket 传输层
 *
 * 实现 IRealtimeTransport 接口。职责：
 * - URL 构建（roomCode + userId → ws:// URL）
 * - WebSocket 创建 + 8s 连接超时
 * - 消息解析（STATE_UPDATE / pong）
 * - 向上触发类型化事件（onOpen / onClose / onError / onStateUpdate / onPong）
 *
 * 不包含：重连逻辑、ping timer、状态管理、平台事件监听。
 * 这些由 ConnectionManager 统一管理。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import { API_BASE_URL } from '@/config/api';
import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';
import { realtimeLog } from '@/utils/logger';

import { getCurrentToken } from './cfFetch';

/** WebSocket 连接超时（ms） */
const WS_CONNECT_TIMEOUT_MS = 8_000;

export class CFRealtimeService implements IRealtimeTransport {
  #ws: WebSocket | null = null;
  #handlers: TransportEventHandlers | null = null;
  /** Generation counter: prevents stale WS events after disconnect/reconnect */
  #generation = 0;

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.#handlers = handlers;
  }

  connect(roomCode: string, _userId: string): void {
    // Close any existing connection first (silent, no event)
    this.#closeWsSilent();

    const generation = ++this.#generation;
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const token = getCurrentToken();
    const wsUrl = `${wsBase}/ws?roomCode=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token ?? '')}`;

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
      this.#parseMessage(event);
    };

    ws.onclose = (event) => {
      if (generation !== this.#generation) return;
      clearTimeout(timeout);
      if (this.#ws === ws) {
        this.#ws = null;
      }
      realtimeLog.info('Transport: WebSocket closed', {
        code: event.code,
        reason: event.reason,
      });
      this.#handlers?.onClose(event.code, event.reason);
    };

    ws.onerror = () => {
      if (generation !== this.#generation) return;
      clearTimeout(timeout);
      realtimeLog.warn('Transport: WebSocket error');
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
      } else if (data.type === 'pong') {
        this.#handlers?.onPong();
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

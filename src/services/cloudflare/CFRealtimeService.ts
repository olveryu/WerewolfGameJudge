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

  connect(roomCode: string, userId: string): void {
    // Close any existing connection first (silent, no event)
    this.#closeWsSilent();

    const generation = ++this.#generation;
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws?roomCode=${encodeURIComponent(roomCode)}&userId=${encodeURIComponent(userId)}`;

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
      const data = JSON.parse(event.data as string);
      if (data.type === 'STATE_UPDATE' && data.state && data.revision != null) {
        realtimeLog.debug('Transport: STATE_UPDATE', { revision: data.revision });
        this.#handlers?.onStateUpdate(
          data.state as GameState,
          data.revision as number,
          data.lastAction as string | undefined,
        );
      } else if (
        data.type === 'SETTLE_RESULT' &&
        typeof data.xpEarned === 'number' &&
        typeof data.newXp === 'number' &&
        typeof data.newLevel === 'number' &&
        typeof data.previousLevel === 'number'
      ) {
        const reward =
          data.reward &&
          typeof data.reward === 'object' &&
          typeof data.reward.type === 'string' &&
          typeof data.reward.id === 'string'
            ? { type: data.reward.type as string, id: data.reward.id as string }
            : undefined;
        this.#handlers?.onSettleResult({
          xpEarned: data.xpEarned,
          newXp: data.newXp,
          newLevel: data.newLevel,
          previousLevel: data.previousLevel,
          reward,
        });
      } else if (data.type === 'pong') {
        this.#handlers?.onPong();
      }
    } catch {
      realtimeLog.warn('Transport: failed to parse WS message');
    }
  }
}

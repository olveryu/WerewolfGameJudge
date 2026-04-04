/**
 * CFRealtimeService — Cloudflare Durable Objects WebSocket 实时传输服务
 *
 * 实现 IRealtimeService 接口，通过原生 WebSocket 连接到 Workers DO。
 * DO 推送 STATE_UPDATE 消息，本服务解析后调用 onDbStateChange 回调。
 *
 * 简化的重连策略（对比 Supabase 6 层恢复）：
 * - L1: WebSocket onclose → 自动重连（指数退避，最多 5 次）
 * - L2: Browser online event → 立即重连
 * - L3: visibilitychange → visible → 拉取最新 state（由上层 useConnectionSync 处理）
 * DO WebSocket 已有服务端心跳（ping/pong），无需客户端额外保活。
 *
 * 不包含游戏逻辑，不持久化状态。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import { API_BASE_URL } from '@/config/api';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import type { ConnectionStatusListener, IRealtimeService } from '@/services/types/IRealtimeService';
import { realtimeLog } from '@/utils/logger';

interface JoinRoomParams {
  roomCode: string;
  userId: string;
  onDbStateChange?: (state: GameState, revision: number) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

export class CFRealtimeService implements IRealtimeService {
  #ws: WebSocket | null = null;
  #connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  readonly #statusListeners: Set<ConnectionStatusListener> = new Set();
  #lastJoinParams: JoinRoomParams | null = null;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #onlineHandler: (() => void) | null = null;
  #pingInterval: ReturnType<typeof setInterval> | null = null;

  addStatusListener(listener: ConnectionStatusListener): () => void {
    this.#statusListeners.add(listener);
    listener(this.#connectionStatus);
    return () => this.#statusListeners.delete(listener);
  }

  #setConnectionStatus(status: ConnectionStatus): void {
    if (this.#connectionStatus !== status) {
      realtimeLog.info(`Connection status: ${this.#connectionStatus} -> ${status}`);
      this.#connectionStatus = status;
      this.#statusListeners.forEach((listener) => listener(status));
    }
  }

  async joinRoom(
    roomCode: string,
    userId: string,
    callbacks: {
      onDbStateChange?: (state: GameState, revision: number) => void;
    },
  ): Promise<void> {
    // Leave previous room
    await this.leaveRoom();

    this.#setConnectionStatus(ConnectionStatus.Connecting);

    this.#lastJoinParams = {
      roomCode,
      userId,
      onDbStateChange: callbacks.onDbStateChange,
    };

    this.#reconnectAttempt = 0;
    await this.#connect(roomCode, userId, callbacks.onDbStateChange);

    // Register browser online event for reconnection (Web only)
    this.#registerOnlineHandler();
  }

  async #connect(
    roomCode: string,
    userId: string,
    onDbStateChange?: (state: GameState, revision: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Build WebSocket URL: replace http(s) with ws(s)
      const wsBase = API_BASE_URL.replace(/^http/, 'ws');
      const wsUrl = `${wsBase}/ws?roomCode=${encodeURIComponent(roomCode)}&userId=${encodeURIComponent(userId)}`;

      const ws = new WebSocket(wsUrl);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error('WebSocket connection timeout'));
        }
      }, 8000);

      ws.onopen = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.#ws = ws;
        this.#reconnectAttempt = 0;
        this.#setConnectionStatus(ConnectionStatus.Syncing);
        this.#startPing();
        realtimeLog.info('WebSocket connected to room:', roomCode);
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === 'STATE_UPDATE' && data.state && data.revision != null) {
            realtimeLog.debug('WS state update, revision:', data.revision);
            onDbStateChange?.(data.state as GameState, data.revision as number);
          }
          // pong messages are handled silently
        } catch {
          realtimeLog.warn('Failed to parse WS message');
        }
      };

      ws.onclose = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error('WebSocket closed before open'));
          return;
        }

        this.#stopPing();
        this.#ws = null;

        // Only auto-reconnect if we have cached params (not intentionally left)
        if (this.#lastJoinParams) {
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          this.#scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error('WebSocket connection error'));
        }
        // After open, errors are handled by onclose
      };
    });
  }

  #scheduleReconnect(): void {
    if (!this.#lastJoinParams) return;
    if (this.#reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      realtimeLog.warn('Max reconnect attempts reached');
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.#reconnectAttempt);
    this.#reconnectAttempt++;

    realtimeLog.info(
      `Reconnecting in ${delay}ms (attempt ${this.#reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    this.#reconnectTimer = setTimeout(() => {
      if (!this.#lastJoinParams) return;
      const { roomCode, userId, onDbStateChange } = this.#lastJoinParams;
      this.#setConnectionStatus(ConnectionStatus.Connecting);
      this.#connect(roomCode, userId, onDbStateChange).catch((err) => {
        realtimeLog.warn('Reconnect failed:', err instanceof Error ? err.message : err);
        this.#scheduleReconnect();
      });
    }, delay);
  }

  #registerOnlineHandler(): void {
    if (typeof globalThis.window?.addEventListener !== 'function') return;

    this.#onlineHandler = () => {
      if (!this.#lastJoinParams) return;
      if (this.#connectionStatus === ConnectionStatus.Live) return;

      realtimeLog.info('Browser online event — triggering reconnect');
      // Clear any pending reconnect timer
      if (this.#reconnectTimer) {
        clearTimeout(this.#reconnectTimer);
        this.#reconnectTimer = null;
      }
      this.#reconnectAttempt = 0;
      const { roomCode, userId, onDbStateChange } = this.#lastJoinParams;
      this.#setConnectionStatus(ConnectionStatus.Connecting);
      this.#connect(roomCode, userId, onDbStateChange).catch((err) => {
        realtimeLog.warn(
          'Online-triggered reconnect failed:',
          err instanceof Error ? err.message : err,
        );
        this.#scheduleReconnect();
      });
    };

    globalThis.window.addEventListener('online', this.#onlineHandler);
  }

  #unregisterOnlineHandler(): void {
    if (this.#onlineHandler && typeof globalThis.window?.removeEventListener === 'function') {
      globalThis.window.removeEventListener('online', this.#onlineHandler);
      this.#onlineHandler = null;
    }
  }

  #startPing(): void {
    this.#stopPing();
    // Send ping every 30s to keep connection alive
    this.#pingInterval = setInterval(() => {
      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
  }

  #stopPing(): void {
    if (this.#pingInterval) {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
    }
  }

  markAsLive(): void {
    if (this.#connectionStatus === ConnectionStatus.Syncing) {
      this.#setConnectionStatus(ConnectionStatus.Live);
    }
  }

  async rejoinCurrentRoom(): Promise<void> {
    if (
      this.#connectionStatus === ConnectionStatus.Connecting ||
      this.#connectionStatus === ConnectionStatus.Syncing
    ) {
      realtimeLog.info('rejoinCurrentRoom: skipped (already in progress)');
      return;
    }

    if (!this.#lastJoinParams) {
      throw new Error('CFRealtimeService: cannot rejoin — no cached params');
    }

    const { roomCode, userId, onDbStateChange } = this.#lastJoinParams;
    realtimeLog.info('Dead channel recovery: rejoinCurrentRoom', { roomCode });

    // Close existing WS
    this.#closeWebSocket();

    this.#reconnectAttempt = 0;
    this.#setConnectionStatus(ConnectionStatus.Connecting);
    await this.#connect(roomCode, userId, onDbStateChange);
  }

  async leaveRoom(): Promise<void> {
    // Clear reconnect
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#unregisterOnlineHandler();
    this.#closeWebSocket();
    this.#lastJoinParams = null;
    this.#setConnectionStatus(ConnectionStatus.Disconnected);
    realtimeLog.info('Left room');
  }

  #closeWebSocket(): void {
    this.#stopPing();
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
}

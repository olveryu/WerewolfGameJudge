/**
 * RealtimeService - Supabase Realtime 传输服务（postgres_changes 单通道）
 *
 * 服务端权威架构：所有客户端（Host + Player）平等接收服务端 DB 写入触发的
 * postgres_changes 通知。不使用 Supabase broadcast channel — 减少连接数、
 * 简化架构、消除 broadcast/DB 去重逻辑。
 *
 * 管理单一 Supabase Realtime Channel 生命周期（subscribe/unsubscribe），
 * 监听 postgres_changes（rooms 表 UPDATE）获取 state 变更。
 * 连接状态通过 subscribe status callback 检测。
 * 断线恢复由 SDK 内置心跳 + 重连处理（`worker: true` 保活）。
 * 数据恢复由上层 useConnectionSync 的前台 DB 拉取处理。
 * 不进行客户端广播，不包含游戏逻辑，不持久化游戏状态。
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { isSupabaseConfigured, supabase } from '@/services/infra/supabaseClient';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { realtimeLog } from '@/utils/logger';

/** Status change listener */
type ConnectionStatusListener = (status: ConnectionStatus) => void;

/** Cached joinRoom params for rejoinCurrentRoom (dead channel recovery) */
interface JoinRoomParams {
  roomCode: string;
  userId: string;
  onDbStateChange?: (state: GameState, revision: number) => void;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class RealtimeService {
  /** Single postgres_changes channel for state synchronization + connection detection */
  #channel: RealtimeChannel | null = null;

  // Connection status
  #connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  readonly #statusListeners: Set<ConnectionStatusListener> = new Set();

  /** Callback for DB state changes (postgres_changes) */
  #onDbStateChange: ((state: GameState, revision: number) => void) | null = null;

  /** Cached joinRoom params for dead channel recovery */
  #lastJoinParams: JoinRoomParams | null = null;

  constructor() {}

  #isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  /**
   * Subscribe to connection status changes
   */
  addStatusListener(listener: ConnectionStatusListener): () => void {
    this.#statusListeners.add(listener);
    // Immediately notify of current status
    listener(this.#connectionStatus);
    return () => this.#statusListeners.delete(listener);
  }

  /**
   * Set connection status
   */
  #setConnectionStatus(status: ConnectionStatus): void {
    if (this.#connectionStatus !== status) {
      realtimeLog.info(` Connection status: ${this.#connectionStatus} -> ${status}`);
      this.#connectionStatus = status;
      this.#statusListeners.forEach((listener) => listener(status));
    }
  }

  /**
   * Join a room's realtime channel (postgres_changes single channel)
   */
  async joinRoom(
    roomCode: string,
    userId: string,
    callbacks: {
      /** DB state change callback (postgres_changes — sole state sync channel) */
      onDbStateChange?: (state: GameState, revision: number) => void;
    },
  ): Promise<void> {
    if (!this.#isConfigured()) {
      realtimeLog.warn(' Supabase not configured');
      return;
    }

    // Leave previous room if any
    await this.leaveRoom();

    this.#setConnectionStatus(ConnectionStatus.Connecting);

    this.#onDbStateChange = callbacks.onDbStateChange || null;

    // Cache params for dead channel recovery (rejoinCurrentRoom)
    this.#lastJoinParams = {
      roomCode,
      userId,
      onDbStateChange: callbacks.onDbStateChange,
    };

    // Create single postgres_changes channel
    realtimeLog.info(` Creating channel for db-room:${roomCode}`);
    this.#channel = supabase!.channel(`db-room:${roomCode}`).on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `code=eq.${roomCode}`,
      },
      (payload) => {
        const newRow = payload.new as { game_state?: unknown; state_revision?: number };
        if (
          newRow.game_state &&
          typeof newRow.game_state === 'object' &&
          newRow.state_revision != null
        ) {
          realtimeLog.debug(' DB state change received, revision:', newRow.state_revision);
          this.#onDbStateChange?.(newRow.game_state as GameState, newRow.state_revision);
        }
      },
    );

    // Subscribe with connection status detection
    const subscribePromise = new Promise<void>((resolve, reject) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error('RealtimeService: subscribe timeout after 8s'));
        }
      }, 8000);

      this.#channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (resolved) {
            // Reconnection: Supabase SDK re-established the channel after a drop.
            realtimeLog.info('Channel reconnected after drop');
            this.#setConnectionStatus(ConnectionStatus.Live);
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus(ConnectionStatus.Syncing);
          resolve();
        } else if (status === 'CLOSED') {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error('RealtimeService: channel closed before subscribe completed'));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (resolved) {
            realtimeLog.warn('Channel error after connect:', status);
            this.#setConnectionStatus(ConnectionStatus.Disconnected);
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus(ConnectionStatus.Disconnected);
          reject(new Error(`RealtimeService: subscribe failed with status ${status}`));
        }
      });
    });
    await subscribePromise;

    realtimeLog.info(' Joined room:', roomCode);
  }

  /**
   * Mark connection as live (called after receiving state).
   * Accepts both ConnectionStatus.Syncing (normal flow) and ConnectionStatus.Connecting (DB-fetch recovery).
   */
  markAsLive(): void {
    if (
      this.#connectionStatus === ConnectionStatus.Syncing ||
      this.#connectionStatus === ConnectionStatus.Connecting
    ) {
      this.#setConnectionStatus(ConnectionStatus.Live);
    }
  }

  /**
   * Rejoin the current room by tearing down the dead channel and creating a new one.
   *
   * Dead Channel Recovery: Supabase SDK gives up reconnecting after repeated
   * CHANNEL_ERROR / TIMED_OUT (mobile background cycles). This method uses the
   * cached joinRoom params to destroy the dead channel and rebuild from scratch.
   *
   * Key: `supabase.realtime.disconnect()` forces the underlying WebSocket closed
   * before creating a new channel. Without this, the SDK reuses a stale transport
   * and new channel subscribes timeout indefinitely even after network recovery.
   * The subsequent `joinRoom → channel.subscribe()` triggers `realtime.connect()`
   * automatically, establishing a fresh WebSocket.
   *
   * @throws Error if no previous joinRoom params cached (never joined / already left)
   */
  async rejoinCurrentRoom(): Promise<void> {
    if (!this.#lastJoinParams) {
      throw new Error('RealtimeService: cannot rejoin — no cached joinRoom params');
    }
    const { roomCode, userId, onDbStateChange } = this.#lastJoinParams;
    realtimeLog.info('Dead channel recovery: rejoinCurrentRoom', { roomCode });

    // Force-close the stale WebSocket transport so subscribe() opens a fresh one.
    // Without this, the SDK reuses a dead WS and every subscribe times out.
    supabase?.realtime.disconnect();

    // joinRoom internally calls leaveRoom first, then creates a fresh channel
    await this.joinRoom(roomCode, userId, { onDbStateChange });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (this.#channel) {
      await this.#channel.unsubscribe();
      // removeChannel cleans up the channel from supabase client's internal tracking
      supabase?.removeChannel(this.#channel);
      this.#channel = null;
    }
    this.#onDbStateChange = null;
    this.#lastJoinParams = null;
    this.#setConnectionStatus(ConnectionStatus.Disconnected);
    realtimeLog.info(' Left room');
  }
}

/**
 * RealtimeService - Supabase Realtime 传输服务（postgres_changes 单通道）
 *
 * 服务端权威架构：所有客户端（Host + Player）平等接收服务端 DB 写入触发的
 * postgres_changes 通知。不使用 Supabase broadcast channel — 减少连接数、
 * 简化架构、消除 broadcast/DB 去重逻辑。
 *
 * 管理单一 Supabase Realtime Channel 生命周期（subscribe/unsubscribe），
 * 监听 postgres_changes（rooms 表 UPDATE）获取 state 变更。
 * 连接状态通过 subscribe status callback + browser offline/online 事件检测。
 * 不进行客户端广播，不包含游戏逻辑，不持久化游戏状态。
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { isSupabaseConfigured, supabase } from '@/services/infra/supabaseClient';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { realtimeLog } from '@/utils/logger';

/** Status change listener */
type ConnectionStatusListener = (status: ConnectionStatus) => void;

// =============================================================================
// Service Implementation
// =============================================================================

export class RealtimeService {
  /** Single postgres_changes channel for state synchronization + connection detection */
  #channel: RealtimeChannel | null = null;

  // Connection status
  #connectionStatus: ConnectionStatus = 'disconnected';
  readonly #statusListeners: Set<ConnectionStatusListener> = new Set();

  /** Callback for DB state changes (postgres_changes) */
  #onDbStateChange: ((state: GameState, revision: number) => void) | null = null;

  // Browser offline/online event handlers (bound for cleanup)
  #handleBrowserOffline: (() => void) | null = null;
  #handleBrowserOnline: (() => void) | null = null;

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
    _userId: string,
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

    this.#setConnectionStatus('connecting');

    this.#onDbStateChange = callbacks.onDbStateChange || null;

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
          this.#setConnectionStatus('disconnected');
          reject(new Error('RealtimeService: subscribe timeout after 8s'));
        }
      }, 8000);

      this.#channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (resolved) {
            // Reconnection: Supabase SDK re-established the channel after a drop.
            realtimeLog.info('Channel reconnected after drop');
            this.#setConnectionStatus('live');
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus('syncing');
          resolve();
        } else if (status === 'CLOSED') {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus('disconnected');
          reject(new Error('RealtimeService: channel closed before subscribe completed'));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (resolved) {
            realtimeLog.warn('Channel error after connect:', status);
            this.#setConnectionStatus('disconnected');
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.#setConnectionStatus('disconnected');
          reject(new Error(`RealtimeService: subscribe failed with status ${status}`));
        }
      });
    });
    await subscribePromise;

    realtimeLog.info(' Joined room:', roomCode);

    // Listen for browser offline/online events for instant disconnect detection.
    this.#subscribeBrowserNetworkEvents();
  }

  /**
   * Mark connection as live (called after receiving state).
   * Accepts both 'syncing' (normal flow) and 'connecting' (DB-fetch recovery).
   */
  markAsLive(): void {
    if (this.#connectionStatus === 'syncing' || this.#connectionStatus === 'connecting') {
      this.#setConnectionStatus('live');
    }
  }

  // =========================================================================
  // Browser network event detection
  // =========================================================================

  /**
   * Subscribe to browser offline/online events for instant disconnect detection.
   * Supabase Phoenix heartbeat is ~30s; the browser `offline` event fires
   * immediately when the OS network stack reports a loss.
   */
  #subscribeBrowserNetworkEvents(): void {
    this.#unsubscribeBrowserNetworkEvents();

    if (typeof globalThis.addEventListener !== 'function') return;

    this.#handleBrowserOffline = () => {
      realtimeLog.info('Browser offline event — setting disconnected');
      this.#setConnectionStatus('disconnected');
    };

    this.#handleBrowserOnline = () => {
      // Only transition to 'connecting' if we were disconnected.
      // The Supabase channel reconnect callback will move to syncing → live.
      if (this.#connectionStatus === 'disconnected') {
        realtimeLog.info('Browser online event — setting connecting');
        this.#setConnectionStatus('connecting');
      }
    };

    globalThis.addEventListener('offline', this.#handleBrowserOffline);
    globalThis.addEventListener('online', this.#handleBrowserOnline);
  }

  #unsubscribeBrowserNetworkEvents(): void {
    if (this.#handleBrowserOffline) {
      globalThis.removeEventListener('offline', this.#handleBrowserOffline);
      this.#handleBrowserOffline = null;
    }
    if (this.#handleBrowserOnline) {
      globalThis.removeEventListener('online', this.#handleBrowserOnline);
      this.#handleBrowserOnline = null;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    this.#unsubscribeBrowserNetworkEvents();
    if (this.#channel) {
      await this.#channel.unsubscribe();
      this.#channel = null;
    }
    this.#onDbStateChange = null;
    this.#setConnectionStatus('disconnected');
    realtimeLog.info(' Left room');
  }
}

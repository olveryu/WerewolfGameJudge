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
   * Poll until SDK exits the 'disconnecting' state.
   *
   * Workaround for supabase/realtime-js state machine: disconnect() sets
   * _connectionState to 'disconnecting' synchronously, but transitions to
   * 'disconnected' asynchronously (~100ms via WebSocket onclose / fallback timer).
   * If we call connect() (via channel.subscribe) while isDisconnecting()===true,
   * the SDK silently skips WebSocket creation — causing subscribe to hang.
   *
   * Two callers:
   * - joinRoom: after leaveRoom → removeChannel may trigger SDK disconnect
   * - rejoinCurrentRoom: after explicit disconnect() call
   */
  async #waitForDisconnectDrain(): Promise<void> {
    const POLL_MS = 50;
    const TIMEOUT_MS = 2_000;
    const start = Date.now();
    while (supabase?.realtime.isDisconnecting?.()) {
      if (Date.now() - start > TIMEOUT_MS) {
        realtimeLog.warn('waitForDisconnectDrain: timeout — proceeding anyway');
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  /**
   * Create a postgres_changes channel for the given room.
   * Does NOT subscribe — call #subscribeChannel() after.
   */
  #createChannel(roomCode: string): void {
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
  }

  /**
   * Subscribe the current #channel and wait for SUBSCRIBED status.
   * Rejects on timeout (8s), CLOSED, CHANNEL_ERROR, or TIMED_OUT.
   */
  #subscribeChannel(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
  }

  /**
   * Tear down #channel without resetting #lastJoinParams (preserves dead channel recovery).
   * Used after subscribe failure to prevent zombie channel from corrupting status.
   */
  async #cleanupChannel(): Promise<void> {
    if (!this.#channel) return;
    const channelRef = this.#channel;
    this.#channel = null;
    try {
      await channelRef.unsubscribe();
    } catch {
      realtimeLog.warn('cleanupChannel: unsubscribe error (ignored)');
    }
    try {
      await supabase?.removeChannel(channelRef);
    } catch {
      realtimeLog.warn('cleanupChannel: removeChannel error (ignored)');
    }
    // Splice zombie unconditionally (same workaround as leaveRoom — see comment there).
    // Must run even if unsubscribe/removeChannel threw, otherwise SDK reuses the
    // zombie channel on next supabase.channel(sameTopic) → "cannot add callbacks after subscribe".
    const channels = supabase?.realtime.getChannels() ?? [];
    const idx = channels.indexOf(channelRef);
    if (idx !== -1) channels.splice(idx, 1);
  }

  /**
   * Join a room's realtime channel (postgres_changes single channel).
   *
   * On subscribe timeout, automatically retries once with a fresh WebSocket
   * transport (disconnect → drain → new channel). Mobile WebKit can have
   * transient WS establishment delays; a single retry significantly improves
   * success rate without burdening the user with manual retry.
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

    // SDK's removeChannel() may trigger disconnect() when the last channel is removed.
    // Wait for that async disconnect to complete before creating a new channel.
    await this.#waitForDisconnectDrain();

    this.#setConnectionStatus(ConnectionStatus.Connecting);

    this.#onDbStateChange = callbacks.onDbStateChange || null;

    // Cache params for dead channel recovery (rejoinCurrentRoom)
    this.#lastJoinParams = {
      roomCode,
      userId,
      onDbStateChange: callbacks.onDbStateChange,
    };

    // Attempt subscribe, retry once on transient failure with fresh transport.
    // Transient = timeout (WS establishment delay) or CLOSED (Mobile Safari WS drop).
    const SUBSCRIBE_MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= SUBSCRIBE_MAX_ATTEMPTS; attempt++) {
      this.#createChannel(roomCode);
      try {
        await this.#subscribeChannel();
        realtimeLog.info(' Joined room:', roomCode);
        return;
      } catch (err) {
        // Clean up failed channel to prevent zombie status corruption
        await this.#cleanupChannel();

        const isTransient =
          err instanceof Error &&
          (err.message.includes('subscribe timeout') ||
            err.message.includes('channel closed before subscribe'));

        if (isTransient && attempt < SUBSCRIBE_MAX_ATTEMPTS) {
          realtimeLog.warn(
            `Subscribe failed (attempt ${attempt}/${SUBSCRIBE_MAX_ATTEMPTS}): ${err instanceof Error ? err.message : err}, retrying with fresh transport`,
          );
          // Force-close stale WS so next subscribe opens a fresh one
          supabase?.realtime.disconnect();
          await this.#waitForDisconnectDrain();
          this.#setConnectionStatus(ConnectionStatus.Connecting);
          continue;
        }

        // Non-transient error or final attempt — propagate
        throw err;
      }
    }
  }

  /**
   * Mark connection as live (called after receiving state).
   * Only accepts Syncing — channel must be SUBSCRIBED before marking Live.
   * Connecting is not accepted to prevent false-Live when concurrent fetchStateFromDB
   * succeeds before channel subscription completes.
   */
  markAsLive(): void {
    if (this.#connectionStatus === ConnectionStatus.Syncing) {
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
    // Guard: skip if already connecting/syncing to avoid redundant teardown
    if (
      this.#connectionStatus === ConnectionStatus.Connecting ||
      this.#connectionStatus === ConnectionStatus.Syncing
    ) {
      realtimeLog.info('rejoinCurrentRoom: skipped (already in progress)', {
        status: this.#connectionStatus,
      });
      return;
    }

    if (!this.#lastJoinParams) {
      throw new Error('RealtimeService: cannot rejoin — no cached joinRoom params');
    }
    const { roomCode, userId, onDbStateChange } = this.#lastJoinParams;
    realtimeLog.info('Dead channel recovery: rejoinCurrentRoom', { roomCode });

    // Force-close the stale WebSocket transport so subscribe() opens a fresh one.
    // Without this, the SDK reuses a dead WS and every subscribe times out.
    supabase?.realtime.disconnect();

    // Wait for SDK disconnect to fully complete before rejoining.
    await this.#waitForDisconnectDrain();

    // joinRoom internally calls leaveRoom first, then creates a fresh channel
    await this.joinRoom(roomCode, userId, { onDbStateChange });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (this.#channel) {
      const channelRef = this.#channel;
      this.#channel = null;
      try {
        await channelRef.unsubscribe();
      } catch {
        realtimeLog.warn('leaveRoom: unsubscribe error (ignored)');
      }
      // removeChannel cleans up the channel from supabase client's internal tracking.
      // Must await: removeChannel may call disconnect() when last channel removed,
      // which would tear down a concurrently-created new channel if not serialized.
      try {
        await supabase?.removeChannel(channelRef);
      } catch {
        realtimeLog.warn('leaveRoom: removeChannel error (ignored)');
      }

      // Workaround: realtime-js ≥2.99.3 (PR #2119 phoenix migration) removed
      // the _remove(channel) call from removeChannel(), leaving zombie channels
      // in channels[]. Next supabase.channel(sameTopic) finds the zombie (state=leaving)
      // → subscribe() skips join logic → 8s timeout → infinite reconnect loop.
      // Manually splice the zombie out to restore pre-2.99.3 behavior.
      // Must run unconditionally — even if unsubscribe/removeChannel threw.
      const channels = supabase?.realtime.getChannels() ?? [];
      const idx = channels.indexOf(channelRef);
      if (idx !== -1) channels.splice(idx, 1);
    }
    this.#onDbStateChange = null;
    this.#lastJoinParams = null;
    this.#setConnectionStatus(ConnectionStatus.Disconnected);
    realtimeLog.info(' Left room');
  }
}

/**
 * BroadcastService - Supabase Realtime 广播传输服务
 *
 * 服务端权威架构：所有客户端（Host + Player）平等接收服务端广播的 STATE_UPDATE。
 *
 * 管理 Supabase Realtime Channel 生命周期（subscribe/unsubscribe），
 * 监听服务端广播的 STATE_UPDATE（host event），订阅 postgres_changes
 * （DB 备份通道，可靠补偿 broadcast 丢失），以及 Presence 跟踪。
 * 不进行客户端广播（broadcastAsHost / sendToHost 已删除），
 * 不包含游戏逻辑（校验/结算/流程推进），不持久化游戏状态（DB 写入由服务端负责）。
 */

import { RealtimeChannel } from '@supabase/supabase-js';
// Protocol types - Import for local use
import type { BroadcastGameState, HostBroadcast } from '@werewolf/game-engine/protocol/types';

import { isSupabaseConfigured, supabase } from '@/services/infra/supabaseClient';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { broadcastLog } from '@/utils/logger';

/** Status change listener */
type ConnectionStatusListener = (status: ConnectionStatus) => void;

// =============================================================================
// Service Implementation
// =============================================================================

export class BroadcastService {
  private channel: RealtimeChannel | null = null;
  /** DB state change subscription channel (postgres_changes on rooms table) */
  private dbChannel: RealtimeChannel | null = null;
  private roomCode: string | null = null;

  // Connection status
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly statusListeners: Set<ConnectionStatusListener> = new Set();

  // Callbacks for received messages
  private onHostBroadcast: ((message: HostBroadcast) => void) | null = null;
  private onPresenceChange: ((users: string[]) => void) | null = null;
  /** Callback for DB state changes (postgres_changes backup channel) */
  private onDbStateChange: ((state: BroadcastGameState, revision: number) => void) | null = null;

  // Browser offline/online event handlers (bound for cleanup)
  private handleBrowserOffline: (() => void) | null = null;
  private handleBrowserOnline: (() => void) | null = null;

  constructor() {}

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  /**
   * Subscribe to connection status changes
   */
  addStatusListener(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify of current status
    listener(this.connectionStatus);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Set connection status
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      broadcastLog.info(` Connection status: ${this.connectionStatus} -> ${status}`);
      this.connectionStatus = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }

  /**
   * Join a room's broadcast channel
   */
  async joinRoom(
    roomCode: string,
    userId: string,
    callbacks: {
      onHostBroadcast?: (message: HostBroadcast) => void;
      onPresenceChange?: (users: string[]) => void;
      /** DB state change callback (postgres_changes backup channel) */
      onDbStateChange?: (state: BroadcastGameState, revision: number) => void;
    },
  ): Promise<void> {
    if (!this.isConfigured()) {
      broadcastLog.warn(' Supabase not configured');
      return;
    }

    // Leave previous room if any
    await this.leaveRoom();

    this.setConnectionStatus('connecting');

    this.roomCode = roomCode;
    this.onHostBroadcast = callbacks.onHostBroadcast || null;
    this.onPresenceChange = callbacks.onPresenceChange || null;
    this.onDbStateChange = callbacks.onDbStateChange || null;

    // Create channel with room code
    broadcastLog.info(
      ` Creating channel for room:${roomCode}, userId:${userId.substring(0, 8)}...`,
    );
    this.channel = supabase!.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true, ack: true }, // ack: server confirms receipt before resolving
        presence: { key: userId },
      },
    });

    // Listen for host broadcasts (server-authoritative STATE_UPDATE)
    this.channel.on('broadcast', { event: 'host' }, (payload) => {
      broadcastLog.info(' Received host broadcast:', payload.payload?.type);
      // Supabase broadcast SDK does not provide typed payloads;
      // we control the broadcast format (HostBroadcast has `type` discriminant)
      if (
        this.onHostBroadcast &&
        payload.payload &&
        typeof payload.payload === 'object' &&
        'type' in payload.payload
      ) {
        this.onHostBroadcast(payload.payload as HostBroadcast);
      }
    });

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState() || {};
      const users = Object.keys(state);
      broadcastLog.info(' Presence sync:', users.length, 'users');
      if (this.onPresenceChange) {
        this.onPresenceChange(users);
      }
    });

    // Subscribe to channel with timeout
    const subscribePromise = new Promise<void>((resolve, reject) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.setConnectionStatus('disconnected');
          reject(new Error('BroadcastService: subscribe timeout after 8s'));
        }
      }, 8000);

      this.channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (resolved) {
            // Reconnection: Supabase SDK re-established the channel after a drop.
            // Go straight to 'live' so useConnectionSync auto-recovery can kick in.
            broadcastLog.info('Channel reconnected after drop');
            this.setConnectionStatus('live');
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.setConnectionStatus('syncing');
          resolve();
        } else if (status === 'CLOSED') {
          // Channel was replaced by a new subscribe call (leaveRoom closed it)
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          this.setConnectionStatus('disconnected');
          reject(new Error('BroadcastService: channel closed before subscribe completed'));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (resolved) {
            // Post-connect error: WebSocket dropped while we were connected.
            broadcastLog.warn('Channel error after connect:', status);
            this.setConnectionStatus('disconnected');
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          this.setConnectionStatus('disconnected');
          reject(new Error(`BroadcastService: subscribe failed with status ${status}`));
        }
      });
    });
    await subscribePromise;

    // Track presence
    await this.channel.track({ user_id: userId });

    // Now we're fully connected and syncing
    // Status will be set to 'live' after receiving first STATE_UPDATE
    broadcastLog.info(' Joined room:', roomCode);

    // Listen for browser offline/online events for instant disconnect detection.
    // Supabase Phoenix heartbeat is ~30s; browser events fire immediately.
    this.subscribeBrowserNetworkEvents();

    // Subscribe to DB state changes (reliable backup channel)
    // All clients receive state via both broadcast (fast) and postgres_changes (reliable).
    // Revision-based dedup in GameStore.applySnapshot() handles duplicates.
    if (this.onDbStateChange) {
      this.dbChannel = supabase!
        .channel(`db-room:${roomCode}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `code=eq.${roomCode}`,
          },
          (payload) => {
            // Supabase Realtime postgres_changes payload — typed by our DB schema
            const newRow = payload.new as { game_state?: unknown; state_revision?: number };
            if (
              newRow.game_state &&
              typeof newRow.game_state === 'object' &&
              newRow.state_revision != null
            ) {
              broadcastLog.debug(' DB state change received, revision:', newRow.state_revision);
              this.onDbStateChange?.(
                newRow.game_state as BroadcastGameState,
                newRow.state_revision,
              );
            }
          },
        )
        .subscribe();
    }
  }

  /**
   * Mark connection as live (called after receiving state).
   * Accepts both 'syncing' (normal flow) and 'connecting' (DB-fetch recovery).
   */
  markAsLive(): void {
    if (this.connectionStatus === 'syncing' || this.connectionStatus === 'connecting') {
      this.setConnectionStatus('live');
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
  private subscribeBrowserNetworkEvents(): void {
    this.unsubscribeBrowserNetworkEvents();

    if (typeof globalThis.addEventListener !== 'function') return;

    this.handleBrowserOffline = () => {
      broadcastLog.info('Browser offline event — setting disconnected');
      this.setConnectionStatus('disconnected');
    };

    this.handleBrowserOnline = () => {
      // Only transition to 'connecting' if we were disconnected.
      // The Supabase channel reconnect callback will move to syncing → live.
      if (this.connectionStatus === 'disconnected') {
        broadcastLog.info('Browser online event — setting connecting');
        this.setConnectionStatus('connecting');
      }
    };

    globalThis.addEventListener('offline', this.handleBrowserOffline);
    globalThis.addEventListener('online', this.handleBrowserOnline);
  }

  private unsubscribeBrowserNetworkEvents(): void {
    if (this.handleBrowserOffline) {
      globalThis.removeEventListener('offline', this.handleBrowserOffline);
      this.handleBrowserOffline = null;
    }
    if (this.handleBrowserOnline) {
      globalThis.removeEventListener('online', this.handleBrowserOnline);
      this.handleBrowserOnline = null;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    this.unsubscribeBrowserNetworkEvents();
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.dbChannel) {
      await this.dbChannel.unsubscribe();
      this.dbChannel = null;
    }
    this.roomCode = null;
    this.onHostBroadcast = null;
    this.onPresenceChange = null;
    this.onDbStateChange = null;
    this.setConnectionStatus('disconnected');
    broadcastLog.info(' Left room');
  }
}

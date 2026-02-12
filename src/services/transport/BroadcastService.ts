/**
 * BroadcastService - Supabase Realtime 广播传输服务
 *
 * 职责：
 * - 管理 Supabase Realtime Channel 生命周期（subscribe/unsubscribe）
 * - Host→Player 广播 STATE_UPDATE / ACK / SNAPSHOT_RESPONSE
 * - Player→Host 发送 intent / PlayerMessage
 * - 断线重连 + SNAPSHOT_REQUEST/RESPONSE 状态恢复
 *
 * ✅ 允许：Realtime channel 管理 + 消息收发 + presence
 * ❌ 禁止：游戏逻辑（校验/结算/流程推进）
 * ❌ 禁止：存储游戏状态
 *
 * Protocol Features:
 * - stateRevision: Monotonic counter for ordering state updates
 * - requestId + ACK: Reliable seat/standup actions with acknowledgment
 * - SNAPSHOT_REQUEST/RESPONSE: State recovery for reconnection/packet loss
 */

import { RealtimeChannel } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/config/supabase';
// Protocol types - Import for local use
import type { HostBroadcast, PlayerMessage } from '@/services/protocol/types';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { broadcastLog } from '@/utils/logger';

/** Status change listener */
type ConnectionStatusListener = (status: ConnectionStatus) => void;

// =============================================================================
// Service Implementation
// =============================================================================

export class BroadcastService {
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;

  // Connection status
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly statusListeners: Set<ConnectionStatusListener> = new Set();

  // Callbacks for received messages
  // Host broadcasts include room-public state messages only (PRIVATE_EFFECT has been removed).
  private onHostBroadcast: ((message: HostBroadcast) => void) | null = null;
  private onPlayerMessage: ((message: PlayerMessage, senderId: string) => void) | null = null;
  private onPresenceChange: ((users: string[]) => void) | null = null;

  constructor() {}

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
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
   * Set connection status (public for GameFacade to use on timeout)
   */
  setConnectionStatus(status: ConnectionStatus): void {
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
      onPlayerMessage?: (message: PlayerMessage, senderId: string) => void;
      onPresenceChange?: (users: string[]) => void;
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
    this.onPlayerMessage = callbacks.onPlayerMessage || null;
    this.onPresenceChange = callbacks.onPresenceChange || null;

    // Create channel with room code
    broadcastLog.info(
      ` Creating channel for room:${roomCode}, userId:${userId.substring(0, 8)}...`,
    );
    this.channel = supabase!.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true }, // Receive own broadcasts (for testing)
        presence: { key: userId },
      },
    });

    // Listen for host broadcasts
    this.channel.on('broadcast', { event: 'host' }, (payload) => {
      broadcastLog.info(' Received host broadcast:', payload.payload?.type);
      if (this.onHostBroadcast && payload.payload) {
        // payload.payload is HostBroadcast (public state messages only)
        this.onHostBroadcast(payload.payload as HostBroadcast);
      }
    });

    // Listen for player messages (Host should listen to this)
    this.channel.on('broadcast', { event: 'player' }, (payload) => {
      broadcastLog.info(' Received player message:', payload.payload?.type);
      if (this.onPlayerMessage && payload.payload) {
        const senderId = ((payload as Record<string, unknown>).presence_ref as string) || 'unknown';
        this.onPlayerMessage(payload.payload as PlayerMessage, senderId);
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
          if (resolved) return;
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
          if (resolved) return;
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
  }

  /**
   * Mark connection as live (called after receiving state)
   */
  markAsLive(): void {
    if (this.connectionStatus === 'syncing') {
      this.setConnectionStatus('live');
    }
  }

  /**
   * Mark connection as syncing (called when requesting snapshot)
   */
  markAsSyncing(): void {
    if (this.connectionStatus === 'live') {
      this.setConnectionStatus('syncing');
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.roomCode = null;
    this.onHostBroadcast = null;
    this.onPlayerMessage = null;
    this.onPresenceChange = null;
    this.setConnectionStatus('disconnected');
    broadcastLog.info(' Left room');
  }

  /**
   * Host: Broadcast a message to all players
   */
  async broadcastAsHost(message: HostBroadcast): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn(' Not connected to any room');
      return;
    }

    broadcastLog.info(' Broadcasting as host:', message.type);
    await this.channel.httpSend('host', message);
  }

  /**
   * Player: Send a message to Host
   */
  async sendToHost(message: PlayerMessage): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn(' Not connected to any room');
      return;
    }

    broadcastLog.info(' Sending to host:', message.type);
    await this.channel.httpSend('player', message);
  }

  /**
   * Get current room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /**
   * Check if connected to a room
   */
  isConnected(): boolean {
    return this.channel !== null;
  }
}

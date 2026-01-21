/**
 * Transport - Supabase Realtime 通信抽象层
 *
 * 职责：
 * - 管理 Supabase Realtime channel 连接
 * - 提供类型安全的消息发送/接收
 * - 连接状态管理和事件分发
 *
 * 不做的事：
 * - 业务逻辑
 * - 状态管理
 * - 消息内容解析/验证
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../../config/supabase';
import { broadcastLog } from '../../../utils/logger';
import type { HostBroadcast, PlayerMessage } from '../../legacy/BroadcastService';

// =============================================================================
// Types
// =============================================================================

/** Connection status for UI display */
export type ConnectionStatus = 'connecting' | 'syncing' | 'live' | 'disconnected';

/** Status change listener */
export type ConnectionStatusListener = (status: ConnectionStatus) => void;

/** Callbacks for received messages */
export interface TransportCallbacks {
  /** Called when host broadcasts a message (Player receives) */
  onHostBroadcast?: (msg: HostBroadcast) => void;
  /** Called when player sends a message (Host receives) */
  onPlayerMessage?: (msg: PlayerMessage, senderId: string) => void;
  /** Called when presence changes */
  onPresenceChange?: (userIds: string[]) => void;
}

// =============================================================================
// Transport Implementation
// =============================================================================

export class Transport {
  private static instance: Transport;

  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  private uid: string | null = null;

  // Connection status
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly statusListeners: Set<ConnectionStatusListener> = new Set();

  // Callbacks
  private callbacks: TransportCallbacks = {};

  private constructor() {}

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  static getInstance(): Transport {
    if (!Transport.instance) {
      Transport.instance = new Transport();
    }
    return Transport.instance;
  }

  /** Reset singleton for testing */
  static resetInstance(): void {
    if (Transport.instance) {
      Transport.instance.leaveRoom();
    }
    Transport.instance = undefined as unknown as Transport;
  }

  // ---------------------------------------------------------------------------
  // Configuration Check
  // ---------------------------------------------------------------------------

  /** Check if Supabase is configured */
  isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  // ---------------------------------------------------------------------------
  // Connection Status
  // ---------------------------------------------------------------------------

  /** Get current connection status */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /** Set connection status and notify listeners */
  setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      broadcastLog.info(`Connection status: ${this.connectionStatus} -> ${status}`);
      this.connectionStatus = status;
      this.statusListeners.forEach((listener) => listener(status));
    }
  }

  /** Subscribe to connection status changes */
  addStatusListener(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify of current status
    listener(this.connectionStatus);
    return () => this.statusListeners.delete(listener);
  }

  /** Mark as syncing (called when requesting snapshot) */
  markAsSyncing(): void {
    if (this.connectionStatus === 'live') {
      this.setConnectionStatus('syncing');
    }
  }

  /** Mark as live (called after receiving state) */
  markAsLive(): void {
    if (this.connectionStatus === 'syncing') {
      this.setConnectionStatus('live');
    }
  }

  // ---------------------------------------------------------------------------
  // Room Connection
  // ---------------------------------------------------------------------------

  /**
   * Join a room's broadcast channel
   */
  async joinRoom(
    roomCode: string,
    userId: string,
    callbacks: TransportCallbacks,
  ): Promise<void> {
    if (!this.isConfigured()) {
      broadcastLog.warn('Supabase not configured');
      return;
    }

    // Leave previous room if any
    await this.leaveRoom();

    this.setConnectionStatus('connecting');
    this.roomCode = roomCode;
    this.uid = userId;
    this.callbacks = callbacks;

    // Create channel
    broadcastLog.info(
      `Creating channel for room:${roomCode}, userId:${userId.substring(0, 8)}...`,
    );

    this.channel = supabase!.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });

    // Listen for host broadcasts
    this.channel.on('broadcast', { event: 'host' }, (payload) => {
      broadcastLog.info('Received host broadcast:', payload.payload?.type);
      if (this.callbacks.onHostBroadcast && payload.payload) {
        this.callbacks.onHostBroadcast(payload.payload as HostBroadcast);
      }
    });

    // Listen for player messages (Host listens to this)
    this.channel.on('broadcast', { event: 'player' }, (payload) => {
      broadcastLog.info('Received player message:', payload.payload?.type);
      if (this.callbacks.onPlayerMessage && payload.payload) {
        const senderId = (payload as Record<string, unknown>).presence_ref as string || 'unknown';
        this.callbacks.onPlayerMessage(payload.payload as PlayerMessage, senderId);
      }
    });

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState() || {};
      const userIds = Object.keys(state);
      broadcastLog.info('Presence sync:', userIds.length, 'users');
      if (this.callbacks.onPresenceChange) {
        this.callbacks.onPresenceChange(userIds);
      }
    });

    // Subscribe to channel with timeout
    await this.subscribeWithTimeout();

    // Track presence
    await this.channel.track({ user_id: userId });

    broadcastLog.info('Joined room:', roomCode);
  }

  private async subscribeWithTimeout(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.setConnectionStatus('disconnected');
        reject(new Error('Transport: subscribe timeout after 8s'));
      }, 8000);

      this.channel!.subscribe((status) => {
        broadcastLog.info('Channel status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.setConnectionStatus('syncing');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          this.setConnectionStatus('disconnected');
          reject(new Error(`Transport: subscribe failed with status ${status}`));
        }
      });
    });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.unsubscribe();
      } catch {
        // Ignore errors during unsubscribe
      }
      this.channel = null;
    }
    this.roomCode = null;
    this.uid = null;
    this.callbacks = {};
    this.setConnectionStatus('disconnected');
    broadcastLog.info('Left room');
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  /**
   * Host: Broadcast a message to all players
   */
  async broadcastAsHost(message: HostBroadcast): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn('Not connected to any room');
      return;
    }

    broadcastLog.info('Broadcasting as host:', message.type);
    await this.channel.send({
      type: 'broadcast',
      event: 'host',
      payload: message,
    });
  }

  /**
   * Player: Send a message to Host
   */
  async sendToHost(message: PlayerMessage): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn('Not connected to any room');
      return;
    }

    broadcastLog.info('Sending to host:', message.type);
    await this.channel.send({
      type: 'broadcast',
      event: 'player',
      payload: message,
    });
  }

  // ---------------------------------------------------------------------------
  // State Accessors
  // ---------------------------------------------------------------------------

  /** Get current room code */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /** Get current user id */
  getUid(): string | null {
    return this.uid;
  }

  /** Check if connected to a room */
  isConnected(): boolean {
    return this.channel !== null;
  }
}

export default Transport;

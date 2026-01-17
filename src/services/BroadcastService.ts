/**
 * BroadcastService - Handles Supabase Realtime Broadcast for game state synchronization
 *
 * Architecture:
 * - Host is the Single Source of Truth for game state
 * - Host broadcasts state updates to all players in the room
 * - Players send actions to Host via broadcast
 * - No game state is stored in database (only room basic info)
 *
 * Protocol Features:
 * - stateRevision: Monotonic counter for ordering state updates
 * - requestId + ACK: Reliable seat/standup actions with acknowledgment
 * - SNAPSHOT_REQUEST/RESPONSE: State recovery for reconnection/packet loss
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { RoleId } from '../models/roles';
import type { SchemaId } from '../models/roles/spec';
import type { PublicPayload } from './types/PublicBroadcast';
import { broadcastLog } from '../utils/logger';
import type { PrivateMessage } from './types/PrivateBroadcast';

// =============================================================================
// Connection Status
// =============================================================================

/** Connection status for UI display */
export type ConnectionStatus = 'connecting' | 'syncing' | 'live' | 'disconnected';

/** Status change listener */
export type ConnectionStatusListener = (status: ConnectionStatus) => void;

// =============================================================================
// Message Types
// =============================================================================

/** Messages broadcast by Host to all players */
export type HostBroadcast =
  | { type: 'STATE_UPDATE'; state: BroadcastGameState; revision: number }
  | {
      type: 'ROLE_TURN';
      role: RoleId;
      pendingSeats: number[];
      killedIndex?: number;
      stepId?: SchemaId;
    }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
  // New: Acknowledgment for seat actions (toUid for targeting specific player)
  | {
      type: 'SEAT_ACTION_ACK';
      requestId: string;
      toUid: string;
      success: boolean;
      seat: number;
      reason?: string;
    }
  // New: Snapshot response for state recovery (toUid for targeting specific player)
  | {
      type: 'SNAPSHOT_RESPONSE';
      requestId: string;
      toUid: string;
      state: BroadcastGameState;
      revision: number;
    };

/** Messages sent by players to Host */
export type PlayerMessage =
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: any }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  // New: reveal acknowledgement (client confirms they've read the private reveal popup)
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  // New: Seat action request with requestId for acknowledgment
  | {
      type: 'SEAT_ACTION_REQUEST';
      requestId: string;
      action: 'sit' | 'standup';
      seat: number;
      uid: string;
      displayName?: string;
      avatarUrl?: string;
    }
  // New: Snapshot request for state recovery
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number };

// =============================================================================
// Broadcast State Types (serializable for transmission)
// =============================================================================

export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleId | null; // Only sent to the player themselves or wolves to wolves
  hasViewedRole: boolean;
}

export interface BroadcastGameState {
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[]; // Role configuration (not assigned positions)
  players: Record<number, BroadcastPlayer | null>; // seat -> player
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  // Wolf-specific: which wolves have voted (for showing vote status)
  wolfVoteStatus?: Record<number, boolean>; // seat -> hasVoted
  // Nightmare block: the seat whose skill is disabled this night
  nightmareBlockedSeat?: number;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class BroadcastService {
  private static instance: BroadcastService;
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;

  // Connection status
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly statusListeners: Set<ConnectionStatusListener> = new Set();

  // Callbacks for received messages
  // Host broadcasts include both room-public state and toUid-scoped PRIVATE_EFFECT.
  // IMPORTANT: do NOT cast away PRIVATE_EFFECT here; GameStateService needs it.
  private onHostBroadcast: ((message: HostBroadcast | PrivateMessage) => void) | null = null;
  private onPlayerMessage: ((message: PlayerMessage, senderId: string) => void) | null = null;
  private onPresenceChange: ((users: string[]) => void) | null = null;

  private constructor() {}

  static getInstance(): BroadcastService {
    if (!BroadcastService.instance) {
      BroadcastService.instance = new BroadcastService();
    }
    return BroadcastService.instance;
  }

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
   * Set connection status (public for GameStateService to use on timeout)
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
      onHostBroadcast?: (message: HostBroadcast | PrivateMessage) => void;
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
        // payload.payload is either HostBroadcast (public) or PrivateMessage (PRIVATE_EFFECT)
        this.onHostBroadcast(payload.payload as HostBroadcast | PrivateMessage);
      }
    });

    // Listen for player messages (Host should listen to this)
    this.channel.on('broadcast', { event: 'player' }, (payload) => {
      broadcastLog.info(' Received player message:', payload.payload?.type);
      if (this.onPlayerMessage && payload.payload) {
        const senderId = (payload as any).presence_ref || 'unknown';
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
      const timeout = setTimeout(() => {
        this.setConnectionStatus('disconnected');
        reject(new Error('BroadcastService: subscribe timeout after 8s'));
      }, 8000);

      this.channel!.subscribe((status) => {
        broadcastLog.info(' Channel status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.setConnectionStatus('syncing');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
    await this.channel.send({
      type: 'broadcast',
      event: 'host',
      payload: message,
    });
  }

  /**
   * Host: Broadcast a PUBLIC message to all players (type-safe, whitelist-only)
   *
   * ANTI-CHEAT: Only accepts PublicPayload types (compiler-enforced).
   * Sensitive information MUST use sendPrivate() instead.
   *
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  async broadcastPublic(payload: PublicPayload): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn(' Not connected to any room');
      return;
    }

    broadcastLog.info(' Broadcasting public:', payload.type);
    await this.channel.send({
      type: 'broadcast',
      event: 'host',
      payload,
    });
  }

  /**
   * Host: Send a PRIVATE message to a specific player (type-safe, sensitive info)
   *
   * ANTI-CHEAT:
   * - Only the recipient (toUid) should process this message
   * - UI must filter: only accept if toUid === myUid
   * - Host player has NO visibility privilege (also filtered by toUid)
   *
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  async sendPrivate(message: PrivateMessage): Promise<void> {
    if (!this.channel) {
      broadcastLog.warn(' Not connected to any room');
      return;
    }

    broadcastLog.info(
      ' Sending private to:',
      message.toUid.substring(0, 8),
      'kind:',
      message.payload.kind,
    );
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
      broadcastLog.warn(' Not connected to any room');
      return;
    }

    broadcastLog.info(' Sending to host:', message.type);
    await this.channel.send({
      type: 'broadcast',
      event: 'player',
      payload: message,
    });
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

export default BroadcastService;

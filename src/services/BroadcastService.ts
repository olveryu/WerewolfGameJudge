/**
 * BroadcastService - Handles Supabase Realtime Broadcast for game state synchronization
 * 
 * Architecture:
 * - Host is the Single Source of Truth for game state
 * - Host broadcasts state updates to all players in the room
 * - Players send actions to Host via broadcast
 * - No game state is stored in database (only room basic info)
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { RoleName } from '../models/roles';

// =============================================================================
// Message Types
// =============================================================================

/** Messages broadcast by Host to all players */
export type HostBroadcast = 
  | { type: 'STATE_UPDATE'; state: BroadcastGameState }
  | { type: 'ROLE_TURN'; role: RoleName; pendingSeats: number[]; killedIndex?: number }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' };

/** Messages sent by players to Host */
export type PlayerMessage = 
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleName; target: number | null; extra?: any }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number };

// =============================================================================
// Broadcast State Types (serializable for transmission)
// =============================================================================

export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleName | null;  // Only sent to the player themselves or wolves to wolves
  hasViewedRole: boolean;
}

export interface BroadcastGameState {
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleName[];  // Role configuration (not assigned positions)
  players: Record<number, BroadcastPlayer | null>;  // seat -> player
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  // Wolf-specific: which wolves have voted (for showing vote status)
  wolfVoteStatus?: Record<number, boolean>;  // seat -> hasVoted
}

// =============================================================================
// Service Implementation
// =============================================================================

export class BroadcastService {
  private static instance: BroadcastService;
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  
  // Callbacks for received messages
  private onHostBroadcast: ((message: HostBroadcast) => void) | null = null;
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
   * Join a room's broadcast channel
   */
  async joinRoom(
    roomCode: string,
    userId: string,
    callbacks: {
      onHostBroadcast?: (message: HostBroadcast) => void;
      onPlayerMessage?: (message: PlayerMessage, senderId: string) => void;
      onPresenceChange?: (users: string[]) => void;
    }
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('[BroadcastService] Supabase not configured');
      return;
    }

    // Leave previous room if any
    await this.leaveRoom();

    this.roomCode = roomCode;
    this.onHostBroadcast = callbacks.onHostBroadcast || null;
    this.onPlayerMessage = callbacks.onPlayerMessage || null;
    this.onPresenceChange = callbacks.onPresenceChange || null;

    // Create channel with room code
    console.log(`[BroadcastService] Creating channel for room:${roomCode}, userId:${userId.substring(0, 8)}...`);
    this.channel = supabase!.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true },  // Receive own broadcasts (for testing)
        presence: { key: userId },
      },
    });

    // Listen for host broadcasts
    this.channel.on('broadcast', { event: 'host' }, (payload) => {
      console.log('[BroadcastService] Received host broadcast:', payload.payload?.type);
      if (this.onHostBroadcast && payload.payload) {
        this.onHostBroadcast(payload.payload as HostBroadcast);
      }
    });

    // Listen for player messages (Host should listen to this)
    this.channel.on('broadcast', { event: 'player' }, (payload) => {
      console.log('[BroadcastService] Received player message:', payload.payload?.type);
      if (this.onPlayerMessage && payload.payload) {
        const senderId = (payload as any).presence_ref || 'unknown';
        this.onPlayerMessage(payload.payload as PlayerMessage, senderId);
      }
    });

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState() || {};
      const users = Object.keys(state);
      console.log('[BroadcastService] Presence sync:', users.length, 'users');
      if (this.onPresenceChange) {
        this.onPresenceChange(users);
      }
    });

    // Subscribe to channel with timeout
    const subscribePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('BroadcastService: subscribe timeout after 8s'));
      }, 8000);
      
      this.channel!.subscribe((status) => {
        console.log('[BroadcastService] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error(`BroadcastService: subscribe failed with status ${status}`));
        }
      });
    });
    await subscribePromise;

    // Track presence
    await this.channel.track({ user_id: userId });
    
    console.log('[BroadcastService] Joined room:', roomCode);
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
    console.log('[BroadcastService] Left room');
  }

  /**
   * Host: Broadcast a message to all players
   */
  async broadcastAsHost(message: HostBroadcast): Promise<void> {
    if (!this.channel) {
      console.warn('[BroadcastService] Not connected to any room');
      return;
    }

    console.log('[BroadcastService] Broadcasting as host:', message.type);
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
      console.warn('[BroadcastService] Not connected to any room');
      return;
    }

    console.log('[BroadcastService] Sending to host:', message.type);
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

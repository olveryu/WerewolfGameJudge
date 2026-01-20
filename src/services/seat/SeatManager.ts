/**
 * SeatManager - Handles seat-related operations (sit down / stand up)
 *
 * Responsibilities:
 * - Process seat requests for both Host and Player
 * - Manage pending seat action state (Player waiting for ACK)
 * - Track last seat error for UI display
 * - Unified logic for local (Host) and remote (Player) seat operations
 *
 * @module SeatManager
 */

import type { BroadcastService } from '../BroadcastService';
import type { LocalGameState, LocalPlayer } from '../types/GameStateTypes';
import { GameStatus } from '../types/GameStateTypes';
import { seatManagerLog } from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

/** Seat action result */
export interface SeatResult {
  success: boolean;
  reason?:
    | 'seat_taken'
    | 'not_seated'
    | 'no_state'
    | 'not_authenticated'
    | 'unknown_action'
    | 'timeout_or_rejected'
    | 'unknown';
}

/** Seat error for UI display */
export interface SeatError {
  seat: number;
  reason: 'seat_taken';
}

/** Pending seat action (Player waiting for ACK) */
interface PendingSeatAction {
  requestId: string;
  action: 'sit' | 'standup';
  seat: number;
  timestamp: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
  resolve: (success: boolean) => void;
  reject: (error: Error) => void;
}

/** Seat action request message (from Player to Host) */
export interface SeatActionRequest {
  type: 'SEAT_ACTION_REQUEST';
  requestId: string;
  action: 'sit' | 'standup';
  seat: number;
  uid: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Seat action ACK message (from Host to Player) */
export interface SeatActionAck {
  type: 'SEAT_ACTION_ACK';
  requestId: string;
  toUid: string;
  success: boolean;
  seat: number;
  reason?: string;
}

// =============================================================================
// Dependencies
// =============================================================================

export interface SeatManagerConfig {
  /** Check if current user is Host */
  isHost: () => boolean;
  /** Get current user's UID */
  getMyUid: () => string | null;
  /** Get current game state */
  getState: () => LocalGameState | null;
  /** Update my seat number tracking */
  setMySeatNumber: (seat: number | null) => void;
  /** Get my seat number */
  getMySeatNumber: () => number | null;
  /** Broadcast state update (Host only) */
  broadcastState: () => Promise<void>;
  /** Notify UI listeners */
  notifyListeners: () => void;
  /** BroadcastService for Player → Host communication */
  broadcastService: BroadcastService;
}

// =============================================================================
// SeatManager Class
// =============================================================================

export class SeatManager {
  /** Last seat error for UI display */
  private lastSeatError: SeatError | null = null;

  /** Pending seat action (Player waiting for ACK) */
  private pendingSeatAction: PendingSeatAction | null = null;

  constructor(private readonly config: SeatManagerConfig) {}

  // ===========================================================================
  // Public API: Error State
  // ===========================================================================

  /**
   * Get last seat error for UI display
   */
  getLastSeatError(): SeatError | null {
    return this.lastSeatError;
  }

  /**
   * Clear last seat error
   */
  clearLastSeatError(): void {
    this.lastSeatError = null;
  }

  /**
   * Set last seat error (used by Host message handler)
   */
  setLastSeatError(error: SeatError | null): void {
    this.lastSeatError = error;
  }

  // ===========================================================================
  // Public API: Seat Operations
  // ===========================================================================

  /**
   * Take a seat (unified path for Host and Player)
   * Returns true if successful, false otherwise
   */
  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    const uid = this.config.getMyUid();
    if (!uid) return false;

    if (this.config.isHost()) {
      // Host processes directly
      const result = await this.processSeatAction('sit', seat, uid, displayName, avatarUrl);
      return result.success;
    }

    // Player uses ACK-based protocol
    const success = await this.sendSeatActionWithAck('sit', seat, displayName, avatarUrl);
    return success;
  }

  /**
   * Take a seat with detailed result (unified path)
   * Returns { success, reason } for detailed error handling
   */
  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000,
  ): Promise<SeatResult> {
    const uid = this.config.getMyUid();
    if (!uid) {
      return { success: false, reason: 'not_authenticated' };
    }

    if (this.config.isHost()) {
      const result = await this.processSeatAction('sit', seat, uid, displayName, avatarUrl);
      return result;
    }

    const success = await this.sendSeatActionWithAck(
      'sit',
      seat,
      displayName,
      avatarUrl,
      timeoutMs,
    );
    if (!success) {
      const reason = this.lastSeatError?.reason;
      return { success: false, reason: reason ?? 'unknown' };
    }
    return { success: true };
  }

  /**
   * Leave seat (unified path for Host and Player)
   * Returns true if successful, false otherwise
   */
  async leaveSeat(): Promise<boolean> {
    const uid = this.config.getMyUid();
    const mySeat = this.config.getMySeatNumber();
    if (!uid || mySeat === null) return false;

    if (this.config.isHost()) {
      // Host processes directly
      const result = await this.processSeatAction('standup', mySeat, uid);
      return result.success;
    }

    // Player uses ACK-based protocol
    const success = await this.sendSeatActionWithAck('standup', mySeat);
    return success;
  }

  /**
   * Leave seat with detailed result (unified path)
   * Returns { success, reason } for detailed error handling
   */
  async leaveSeatWithAck(timeoutMs: number = 5000): Promise<SeatResult> {
    const uid = this.config.getMyUid();
    const mySeat = this.config.getMySeatNumber();
    if (!uid || mySeat === null) {
      return { success: false, reason: 'not_seated' };
    }

    if (this.config.isHost()) {
      const result = await this.processSeatAction('standup', mySeat, uid);
      return result;
    }

    const success = await this.sendSeatActionWithAck(
      'standup',
      mySeat,
      undefined,
      undefined,
      timeoutMs,
    );
    return { success, reason: success ? undefined : 'timeout_or_rejected' };
  }

  // ===========================================================================
  // Host: Process Seat Actions
  // ===========================================================================

  /**
   * Host: Process seat action locally
   * This is the single source of truth for seat operations
   */
  async processSeatAction(
    action: 'sit' | 'standup',
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<SeatResult> {
    const state = this.config.getState();
    if (!state) return { success: false, reason: 'no_state' };

    if (action === 'sit') {
      return this.processSit(state, seat, uid, displayName, avatarUrl);
    } else if (action === 'standup') {
      return this.processStandUp(state, seat, uid);
    }

    return { success: false, reason: 'unknown_action' };
  }

  /**
   * Host: Process sit action
   */
  private async processSit(
    state: LocalGameState,
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<SeatResult> {
    // Check if seat is available
    if (state.players.get(seat) !== null) {
      return { success: false, reason: 'seat_taken' };
    }

    // Clear any old seats for this player
    this.clearSeatsByUid(uid, seat);

    // Assign seat
    const player: LocalPlayer = {
      uid,
      seatNumber: seat,
      displayName,
      avatarUrl,
      role: null,
      hasViewedRole: false,
    };
    state.players.set(seat, player);

    // Track my seat if this is me
    if (uid === this.config.getMyUid()) {
      this.config.setMySeatNumber(seat);
    }

    // Update status if all seated
    this.updateStatusAfterSit(state);

    await this.config.broadcastState();
    this.config.notifyListeners();
    return { success: true };
  }

  /**
   * Host: Update game status after a player sits
   */
  private updateStatusAfterSit(state: LocalGameState): void {
    const allSeated = Array.from(state.players.values()).every((p) => p !== null);
    if (allSeated && state.status === GameStatus.unseated) {
      state.status = GameStatus.seated;
    }
  }

  /**
   * Host: Process stand up action
   */
  private async processStandUp(
    state: LocalGameState,
    seat: number,
    uid: string,
  ): Promise<SeatResult> {
    // Verify player is in this seat
    const player = state.players.get(seat);
    if (player?.uid !== uid) {
      return { success: false, reason: 'not_seated' };
    }

    // Clear seat
    state.players.set(seat, null);

    // Track my seat if this is me
    if (uid === this.config.getMyUid()) {
      this.config.setMySeatNumber(null);
    }

    // Revert status if needed
    if (state.status === GameStatus.seated) {
      state.status = GameStatus.unseated;
    }

    await this.config.broadcastState();
    this.config.notifyListeners();
    return { success: true };
  }

  /**
   * Host: Handle seat action request from Player
   */
  async handleSeatActionRequest(msg: SeatActionRequest): Promise<void> {
    const state = this.config.getState();
    if (!state) return;

    seatManagerLog.info(
      `Seat action request: ${msg.action} seat ${msg.seat} from ${msg.uid.substring(0, 8)}`,
    );

    // Use unified processSeatAction
    const result = await this.processSeatAction(
      msg.action,
      msg.seat,
      msg.uid,
      msg.displayName,
      msg.avatarUrl,
    );

    // Send ACK to player
    await this.config.broadcastService.broadcastAsHost({
      type: 'SEAT_ACTION_ACK',
      requestId: msg.requestId,
      toUid: msg.uid,
      success: result.success,
      seat: msg.seat,
      reason: result.reason,
    });
  }

  /**
   * Player: Handle seat action ACK from Host
   */
  handleSeatActionAck(msg: SeatActionAck): void {
    // Only handle if addressed to us
    if (msg.toUid !== this.config.getMyUid()) {
      return;
    }

    // Only handle if we have a pending request with matching ID
    if (!this.pendingSeatAction || this.pendingSeatAction.requestId !== msg.requestId) {
      return;
    }

    seatManagerLog.info(
      `Seat action ACK: ${msg.success ? 'success' : 'failed'} for seat ${msg.seat}`,
    );

    // Clear timeout first
    clearTimeout(this.pendingSeatAction.timeoutHandle);

    if (msg.success) {
      // Update local state based on action
      if (this.pendingSeatAction.action === 'sit') {
        this.config.setMySeatNumber(msg.seat);
      } else {
        this.config.setMySeatNumber(null);
      }
      this.pendingSeatAction.resolve(true);
    } else {
      // Action failed
      if (msg.reason === 'seat_taken') {
        this.lastSeatError = { seat: msg.seat, reason: 'seat_taken' };
      }
      this.pendingSeatAction.resolve(false);
    }

    this.pendingSeatAction = null;
    this.config.notifyListeners();
  }

  // ===========================================================================
  // Private: Helpers
  // ===========================================================================

  /**
   * Clear ALL seats occupied by a given uid (defensive: handles dirty data)
   * Optionally skip a specific seat (used when that seat is the new target)
   */
  private clearSeatsByUid(uid: string, skipSeat?: number): void {
    const state = this.config.getState();
    if (!state) return;
    for (const [seat, player] of state.players.entries()) {
      if (player?.uid === uid && seat !== skipSeat) {
        state.players.set(seat, null);
      }
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Player: Send seat action and wait for ACK
   */
  private async sendSeatActionWithAck(
    action: 'sit' | 'standup',
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    const uid = this.config.getMyUid();
    if (!uid) return false;

    // Cancel any pending action (clear timeout first)
    if (this.pendingSeatAction) {
      clearTimeout(this.pendingSeatAction.timeoutHandle);
      this.pendingSeatAction.reject(new Error('Cancelled by new action'));
      this.pendingSeatAction = null;
    }

    const requestId = this.generateRequestId();

    return new Promise<boolean>((resolve, reject) => {
      // Set up timeout first
      const timeoutHandle = setTimeout(() => {
        if (this.pendingSeatAction?.requestId === requestId) {
          seatManagerLog.info(`Seat action timeout for ${action} seat ${seat}`);
          this.pendingSeatAction = null;
          this.config.notifyListeners();
          resolve(false);
        }
      }, timeoutMs);

      // Set up pending action with timeout handle
      this.pendingSeatAction = {
        requestId,
        action,
        seat,
        timestamp: Date.now(),
        timeoutHandle,
        resolve,
        reject,
      };

      // Send request
      this.config.broadcastService
        .sendToHost({
          type: 'SEAT_ACTION_REQUEST',
          requestId,
          action,
          seat,
          uid,
          displayName,
          avatarUrl,
        })
        .catch((err) => {
          if (this.pendingSeatAction?.requestId === requestId) {
            clearTimeout(this.pendingSeatAction.timeoutHandle);
            this.pendingSeatAction = null;
            reject(err);
          }
        });

      // Note: resolve/reject will be called by handleSeatActionAck or timeout
    });
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clean up pending actions (call on disconnect/reset)
   */
  cleanup(): void {
    if (this.pendingSeatAction) {
      clearTimeout(this.pendingSeatAction.timeoutHandle);
      this.pendingSeatAction.reject(new Error('Cleanup'));
      this.pendingSeatAction = null;
    }
    this.lastSeatError = null;
  }
}

/**
 * PlayerCoordinator: Handles all Player-specific game logic
 *
 * Extracted from GameStateService as part of Host/Player separation.
 * Responsible for:
 * - Handling Host broadcasts (STATE_UPDATE, ROLE_TURN, NIGHT_END, etc.)
 * - Player actions (submitAction, submitWolfVote, submitRevealAck)
 * - Player seat management (takeSeat, leaveSeat) via SeatManager
 * - State synchronization with Host (requestSnapshot)
 * - Player UI state tracking (playerViewedRole)
 *
 * Design Principles:
 * - Does NOT modify state directly; uses StateManager callbacks
 * - Delegates seat management to SeatManager
 * - Delegates broadcast sending to BroadcastCoordinator
 * - Pure coordination layer between Host broadcasts and local state
 */

import { playerLog } from '../../../utils/logger';
import { GameStatus, LocalGameState } from '../../v2/types/GameState';
import { BroadcastGameState, HostBroadcast } from '../BroadcastService';
import { RoleId } from '../../../models/roles';
import { StateManager } from '../state/StateManager';
import { BroadcastCoordinator } from '../broadcast/BroadcastCoordinator';
import { SeatManager } from '../seat/SeatManager';

// Type alias for clarity
type GameState = LocalGameState;

// Pending snapshot request tracking
interface PendingSnapshotRequest {
  requestId: string;
  timestamp: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

// Configuration for PlayerCoordinator
export interface PlayerCoordinatorConfig {
  // State access
  getState: () => GameState | null;
  getMyUid: () => string | null;
  getMySeatNumber: () => number | null;
  getMyRole: () => RoleId | null;
  getStateRevision: () => number;
  setStateRevision: (revision: number) => void;
  setMySeatNumber: (seat: number | null) => void;
  isHost: () => boolean;

  // Callbacks
  onNotifyListeners: () => void;

  // For handling player viewed role on Host side
  onPlayerViewedRole?: (seat: number) => Promise<void>;

  // For handling player actions on Host side (when player IS the Host)
  onPlayerAction?: (
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ) => Promise<void>;
  onWolfVote?: (seat: number, target: number) => Promise<void>;
  onRevealAck?: (seat: number, role: RoleId, revision: number) => Promise<void>;
}

export class PlayerCoordinator {
  // Dependencies
  private readonly stateManager: StateManager;
  private readonly broadcastCoordinator: BroadcastCoordinator;
  private readonly seatManager: SeatManager;
  private readonly config: PlayerCoordinatorConfig;

  // State tracking
  private pendingSnapshotRequest: PendingSnapshotRequest | null = null;

  constructor(
    stateManager: StateManager,
    broadcastCoordinator: BroadcastCoordinator,
    seatManager: SeatManager,
    config: PlayerCoordinatorConfig,
  ) {
    this.stateManager = stateManager;
    this.broadcastCoordinator = broadcastCoordinator;
    this.seatManager = seatManager;
    this.config = config;
  }

  // ===========================================================================
  // Host Broadcast Handling
  // ===========================================================================

  /**
   * Handle incoming host broadcast messages
   * Called by GameStateService when a broadcast is received from Host
   */
  handleHostBroadcast(msg: HostBroadcast): void {
    // Legacy PRIVATE_EFFECT messages are no longer used (removed in refactor)
    // Type guard for any unexpected message types
    if ((msg as { type: string }).type === 'PRIVATE_EFFECT') {
      playerLog.debug('Ignoring legacy PRIVATE_EFFECT message');
      return;
    }

    playerLog.info('Received host broadcast:', msg.type);

    switch (msg.type) {
      case 'STATE_UPDATE':
        // Host is authoritative - should not overwrite local state from broadcast
        if (this.config.isHost()) {
          playerLog.info('Ignoring own STATE_UPDATE broadcast');
          return;
        }
        this.applyStateUpdate(msg.state, msg.revision);
        break;

      case 'ROLE_TURN':
        // UI-only: stash current stepId for schema-driven UI mapping.
        // Logic continues to come from STATE_UPDATE (Host is authoritative).
        if (!this.config.isHost() && this.config.getState()) {
          this.stateManager.batchUpdate({ currentStepId: msg.stepId });
        }
        break;

      case 'NIGHT_END':
        // Update local deaths
        if (this.config.getState()) {
          this.stateManager.batchUpdate({
            lastNightDeaths: msg.deaths,
            status: GameStatus.ended,
          });
        }
        break;

      case 'SEAT_REJECTED':
        // Only the player who requested the seat should handle this
        if (msg.requestUid === this.config.getMyUid()) {
          playerLog.info('My seat request rejected:', msg.seat, msg.reason);
          this.seatManager.setLastSeatError({ seat: msg.seat, reason: msg.reason });
          this.config.onNotifyListeners();
        }
        break;

      case 'SEAT_ACTION_ACK':
        // Handle ACK for pending seat action
        this.handleSeatActionAck(msg);
        break;

      case 'SNAPSHOT_RESPONSE':
        // Handle snapshot response (only if we requested it)
        this.handleSnapshotResponse(msg);
        break;

      case 'GAME_RESTARTED':
        // Delegate to StateManager
        this.stateManager.resetForGameRestart();
        break;
    }
  }

  /**
   * Handle seat action ACK from Host
   * Delegated to SeatManager
   */
  private handleSeatActionAck(msg: {
    requestId: string;
    success: boolean;
    seat: number;
    toUid: string;
    reason?: string;
  }): void {
    this.seatManager.handleSeatActionAck({
      type: 'SEAT_ACTION_ACK',
      ...msg,
    });
  }

  /**
   * Handle snapshot response from Host
   */
  private handleSnapshotResponse(msg: {
    requestId: string;
    toUid: string;
    state: BroadcastGameState;
    revision: number;
  }): void {
    const myUid = this.config.getMyUid();

    // Only handle if addressed to us
    if (msg.toUid !== myUid) {
      return;
    }

    // Only handle if we have a pending request with matching ID
    if (!this.pendingSnapshotRequest || this.pendingSnapshotRequest.requestId !== msg.requestId) {
      playerLog.info('Ignoring snapshot - no matching pending request');
      return;
    }

    playerLog.info('Snapshot received, revision:', msg.revision);

    // Clear timeout
    clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
    this.pendingSnapshotRequest = null;

    // Apply state unconditionally (snapshot is always authoritative)
    this.applyStateUpdate(msg.state, msg.revision);

    // Mark connection as live
    this.broadcastCoordinator.markAsLive();
  }

  /**
   * Apply state update from Host broadcast
   */
  private applyStateUpdate(broadcastState: BroadcastGameState, revision?: number): void {
    // Mark connection as live after receiving state
    this.broadcastCoordinator.markAsLive();

    // Delegate to StateManager for state conversion
    const currentRevision = this.config.getStateRevision();
    const effectiveRevision = revision ?? currentRevision + 1;
    const result = this.stateManager.applyBroadcastState(
      broadcastState,
      effectiveRevision,
      this.config.getMyUid(),
    );

    if (!result.applied) {
      playerLog.info(`Skipping stale update (rev ${effectiveRevision})`);
      return;
    }

    // Update local tracking
    if (result.mySeat !== null) {
      this.config.setMySeatNumber(result.mySeat);
    }
    this.config.setStateRevision(effectiveRevision);

    // Note: StateManager.applyBroadcastState already notifies listeners,
    // and state getter now delegates to StateManager, so no sync needed.
  }

  // ===========================================================================
  // Player Actions
  // ===========================================================================

  /**
   * Take a seat (unified path for Host and Player)
   * Delegated to SeatManager
   */
  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    return this.seatManager.takeSeat(seat, displayName, avatarUrl);
  }

  /**
   * Leave seat (unified path for Host and Player)
   * Delegated to SeatManager
   */
  async leaveSeat(): Promise<boolean> {
    return this.seatManager.leaveSeat();
  }

  /**
   * Take a seat with ACK (unified path)
   * Delegated to SeatManager
   */
  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.seatManager.takeSeatWithAck(seat, displayName, avatarUrl, timeoutMs);
  }

  /**
   * Leave seat with ACK (unified path)
   * Delegated to SeatManager
   */
  async leaveSeatWithAck(timeoutMs: number = 5000): Promise<{ success: boolean; reason?: string }> {
    return this.seatManager.leaveSeatWithAck(timeoutMs);
  }

  /**
   * Mark role as viewed
   * Unified path: Both Host and Player call the same handler
   */
  async playerViewedRole(): Promise<void> {
    const mySeatNumber = this.config.getMySeatNumber();
    if (mySeatNumber === null) return;

    if (this.config.isHost()) {
      // Host processes directly via callback
      if (this.config.onPlayerViewedRole) {
        await this.config.onPlayerViewedRole(mySeatNumber);
      }
      return;
    }

    await this.broadcastCoordinator.sendViewedRole(mySeatNumber);
  }

  /**
   * Submit action (unified path for Host and Player)
   * Both call the same handler: handlePlayerAction
   */
  async submitAction(target: number | null, extra?: unknown): Promise<void> {
    const mySeatNumber = this.config.getMySeatNumber();
    const state = this.config.getState();
    if (mySeatNumber === null || !state) return;

    const myRole = this.config.getMyRole();
    if (!myRole) return;

    if (this.config.isHost()) {
      // Host processes directly via callback
      if (this.config.onPlayerAction) {
        await this.config.onPlayerAction(mySeatNumber, myRole, target, extra);
      }
      return;
    }

    await this.broadcastCoordinator.sendAction(mySeatNumber, myRole, target, extra);
  }

  /**
   * Submit wolf vote (unified path for Host and Player)
   * Both call the same handler: handleWolfVote
   */
  async submitWolfVote(target: number): Promise<void> {
    const mySeatNumber = this.config.getMySeatNumber();
    if (mySeatNumber === null) return;

    if (this.config.isHost()) {
      // Host processes directly via callback
      if (this.config.onWolfVote) {
        await this.config.onWolfVote(mySeatNumber, target);
      }
      return;
    }

    await this.broadcastCoordinator.sendWolfVote(mySeatNumber, target);
  }

  /**
   * Submit reveal acknowledgement (unified path for Host and Player)
   * Both call the same handler: handleRevealAck
   * This lets the Host advance the night flow for reveal roles (seer/psychic/gargoyle/wolfRobot)
   */
  async submitRevealAck(role: RoleId): Promise<void> {
    const state = this.config.getState();
    const mySeatNumber = this.config.getMySeatNumber();
    if (!state || mySeatNumber === null) return;

    const stateRevision = this.config.getStateRevision();

    if (this.config.isHost()) {
      // Host processes directly via callback
      if (this.config.onRevealAck) {
        await this.config.onRevealAck(mySeatNumber, role, stateRevision);
      }
      return;
    }

    await this.broadcastCoordinator.sendRevealAck(mySeatNumber, role, stateRevision);
  }

  // ===========================================================================
  // State Synchronization
  // ===========================================================================

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Request full state snapshot from Host (for recovery)
   * Returns true if request was sent, false if failed
   * Timeout after 10s will mark connection as disconnected
   */
  async requestSnapshot(timeoutMs: number = 10000): Promise<boolean> {
    if (this.config.isHost()) {
      // Host is authoritative, no need to request
      return true;
    }

    const myUid = this.config.getMyUid();
    if (!myUid) return false;

    // Cancel any pending snapshot request
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }

    // Mark as syncing
    this.broadcastCoordinator.markAsSyncing();

    const requestId = this.generateRequestId();
    const currentRevision = this.config.getStateRevision();

    playerLog.info('Requesting snapshot, lastRev:', currentRevision);

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info('Snapshot request timeout');
        this.pendingSnapshotRequest = null;
        // Mark as disconnected on timeout
        this.broadcastCoordinator.setConnectionStatus('disconnected');
        this.config.onNotifyListeners();
      }
    }, timeoutMs);

    // Store pending request
    this.pendingSnapshotRequest = {
      requestId,
      timestamp: Date.now(),
      timeoutHandle,
    };

    try {
      await this.broadcastCoordinator.requestSnapshot(requestId, myUid, currentRevision);
    } catch (err) {
      // sendToHost failed - rollback pending state immediately
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info('Snapshot request send failed:', err);
        clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
        this.pendingSnapshotRequest = null;
        this.broadcastCoordinator.setConnectionStatus('disconnected');
        this.config.onNotifyListeners();
      }
      return false;
    }

    // Response will be handled by handleSnapshotResponse
    // Timeout will mark as disconnected if no response
    return true;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Reset coordinator state (e.g., when leaving room)
   */
  reset(): void {
    // Clear pending snapshot request
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }
  }
}

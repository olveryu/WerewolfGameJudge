/**
 * StateManager - Pure state management module
 *
 * This is the Single Source of Truth for game state.
 * Extracted from GameStateService as part of the God Class refactoring.
 *
 * Responsibilities:
 * - Maintain LocalGameState
 * - Manage state revision counter
 * - Notify listeners on state changes
 * - Convert between LocalGameState and BroadcastGameState
 *
 * NOT responsible for:
 * - Broadcasting (handled by BroadcastCoordinator)
 * - Game logic (handled by ActionProcessor, NightFlowService)
 * - Persistence (handled by StatePersistence)
 */

import { createTemplateFromRoles, type GameTemplate } from '../../models/Template';
import { type RoleId, isWolfRole } from '../../models/roles';
import { type RoleAction } from '../../models/actions/RoleAction';
import { hostLog, playerLog } from '../../utils/logger';

import type {
  LocalGameState,
  LocalPlayer,
  GameStateListener,
} from '../types/GameStateTypes';
import { GameStatus } from '../types/GameStateTypes';

import type { BroadcastGameState, BroadcastPlayer } from '../BroadcastService';

// =============================================================================
// Configuration
// =============================================================================

export interface StateManagerConfig {
  /**
   * Host only: callback triggered after each state update.
   * Used by GameCoordinator to trigger broadcast and persistence.
   */
  onStateChange?: (state: BroadcastGameState, revision: number) => void;

  /**
   * Log prefix for debugging
   */
  logPrefix?: string;
}

// =============================================================================
// StateManager Implementation
// =============================================================================

export class StateManager {
  private state: LocalGameState | null = null;
  private listeners: Set<GameStateListener> = new Set();
  private revision: number = 0;
  private readonly config: StateManagerConfig;

  constructor(config: StateManagerConfig = {}) {
    this.config = config;
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get current state (read-only reference)
   */
  getState(): LocalGameState | null {
    return this.state;
  }

  /**
   * Get current state revision
   */
  getRevision(): number {
    return this.revision;
  }

  /**
   * Check if state is initialized
   */
  hasState(): boolean {
    return this.state !== null;
  }

  // ===========================================================================
  // Host: State Updates (Single Entry Point)
  // ===========================================================================

  /**
   * Update state using an updater function.
   * This is the ONLY way to modify state for Host.
   *
   * Automatically:
   * 1. Increments revision
   * 2. Notifies all listeners
   * 3. Triggers onStateChange callback (for broadcast)
   *
   * @param updater - Function that receives current state and returns partial updates
   */
  updateState(updater: (current: LocalGameState) => Partial<LocalGameState>): void {
    if (!this.state) {
      throw new Error('[StateManager] Cannot update: state not initialized');
    }

    const updates = updater(this.state);
    // Immutable update: create new state object
    // GameStateService.state getter delegates to getState(), so this works correctly
    this.state = { ...this.state, ...updates };
    this.revision++;

    this.notifyListeners();

    // Trigger broadcast callback if configured
    if (this.config.onStateChange) {
      const broadcastState = this.toBroadcastState();
      this.config.onStateChange(broadcastState, this.revision);
    }
  }

  /**
   * Batch update multiple fields at once.
   * Convenience wrapper around updateState.
   */
  batchUpdate(updates: Partial<LocalGameState>): void {
    this.updateState(() => updates);
  }

  /**
   * Initialize state (called once when creating/joining room)
   * Does NOT increment revision (this is the baseline)
   */
  initialize(state: LocalGameState): void {
    this.state = state;
    this.revision = 0;
    this.notifyListeners();

    hostLog.debug('[StateManager] State initialized');
  }

  /**
   * Reset state (called when leaving room)
   */
  reset(): void {
    this.state = null;
    this.revision = 0;
    this.listeners.clear();

    hostLog.debug('[StateManager] State reset');
  }

  /**
   * Reset state for game restart (keeps players but clears game data).
   * Used by Players when receiving GAME_RESTARTED broadcast.
   */
  resetForGameRestart(): void {
    if (!this.state) return;

    this.state.status = GameStatus.seated;
    this.state.actions = new Map();
    this.state.wolfVotes = new Map();
    this.state.currentActionerIndex = 0;
    this.state.isAudioPlaying = false;
    this.state.lastNightDeaths = [];
    this.state.currentStepId = undefined;
    // Clear role-specific context
    this.state.witchContext = undefined;
    this.state.seerReveal = undefined;
    this.state.psychicReveal = undefined;
    this.state.gargoyleReveal = undefined;
    this.state.wolfRobotReveal = undefined;
    this.state.confirmStatus = undefined;
    this.state.actionRejected = undefined;
    // Clear roles
    this.state.players.forEach((p) => {
      if (p) {
        p.role = null;
        p.hasViewedRole = false;
      }
    });

    this.notifyListeners();
    hostLog.debug('[StateManager] State reset for game restart');
  }

  // ===========================================================================
  // Player: Apply Broadcast State
  // ===========================================================================

  /**
   * Apply state received from Host broadcast.
   * Used by Players to sync their local state.
   *
   * @param broadcast - BroadcastGameState from Host
   * @param revision - State revision from Host
   * @param myUid - Current player's UID (for tracking seat)
   * @returns { applied, mySeat } - Whether update was applied and player's seat
   */
  applyBroadcastState(
    broadcast: BroadcastGameState,
    revision: number,
    myUid: string | null,
  ): { applied: boolean; mySeat: number | null } {
    // Skip stale updates
    if (revision <= this.revision) {
      playerLog.debug(`[StateManager] Skipping stale update (rev ${revision} <= ${this.revision})`);
      return { applied: false, mySeat: null };
    }

    this.revision = revision;
    const { state, mySeat } = this.broadcastToLocal(broadcast, myUid);
    this.state = state;
    this.notifyListeners();

    playerLog.debug(`[StateManager] Applied broadcast state, rev=${revision}, mySeat=${mySeat}`);
    return { applied: true, mySeat };
  }

  // ===========================================================================
  // Subscription
  // ===========================================================================

  /**
   * Subscribe to state changes.
   * Listener is called immediately with current state if available.
   *
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);

    // Immediately call listener with current state if available
    if (this.state) {
      try {
        listener({ ...this.state });
      } catch (err) {
        hostLog.error('[StateManager] Listener error during subscribe:', err);
      }
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ===========================================================================
  // State Conversion
  // ===========================================================================

  /**
   * Convert LocalGameState to BroadcastGameState for network transmission.
   * Used by Host to broadcast state to Players.
   */
  toBroadcastState(): BroadcastGameState {
    if (!this.state) {
      throw new Error('[StateManager] Cannot convert: state not initialized');
    }

    // Convert players Map to Record
    const players: Record<number, BroadcastPlayer | null> = {};
    this.state.players.forEach((p, seat) => {
      if (p) {
        players[seat] = {
          uid: p.uid,
          seatNumber: p.seatNumber,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          role: p.role, // Include role - client decides what to show
          hasViewedRole: p.hasViewedRole,
        };
      } else {
        players[seat] = null;
      }
    });

    // Build wolf vote status (only wolves that have voted)
    // TODO(Phase 1.5): GameStateService.toBroadcastState uses getVotingWolfSeats() to show
    // all wolves that should vote (with true/false for each). This simpler implementation
    // only shows wolves that have already voted (all true). After full migration, unify
    // the logic by either:
    // 1. Moving getVotingWolfSeats() logic here, or
    // 2. Accepting this simpler approach if UI doesn't need to show "not yet voted" wolves
    const wolfVoteStatus: Record<number, boolean> = {};
    this.state.wolfVotes.forEach((_, seat) => {
      wolfVoteStatus[seat] = true;
    });

    // Get nightmare blocked seat from actions
    const nightmareAction = this.state.actions.get('nightmare');
    const nightmareBlockedSeat =
      nightmareAction?.kind === 'target' ? nightmareAction.targetSeat : undefined;

    return {
      roomCode: this.state.roomCode,
      hostUid: this.state.hostUid,
      status: this.state.status,
      templateRoles: this.state.template.roles,
      players,
      currentActionerIndex: this.state.currentActionerIndex,
      isAudioPlaying: this.state.isAudioPlaying,
      wolfVoteStatus,
      nightmareBlockedSeat,
      wolfKillDisabled: this.state.wolfKillDisabled,
      // Role-specific context (all data is public, UI filters by myRole)
      witchContext: this.state.witchContext,
      seerReveal: this.state.seerReveal,
      psychicReveal: this.state.psychicReveal,
      gargoyleReveal: this.state.gargoyleReveal,
      wolfRobotReveal: this.state.wolfRobotReveal,
      confirmStatus: this.state.confirmStatus,
      actionRejected: this.state.actionRejected,
    };
  }

  /**
   * Convert BroadcastGameState to LocalGameState.
   * Used by Players when receiving state from Host.
   *
   * @param broadcast - BroadcastGameState from Host
   * @param myUid - Current player's UID (for tracking seat)
   * @returns { state, mySeat }
   */
  private broadcastToLocal(
    broadcast: BroadcastGameState,
    myUid: string | null,
  ): { state: LocalGameState; mySeat: number | null } {
    const template = createTemplateFromRoles(broadcast.templateRoles);
    let mySeat: number | null = null;

    // Convert players Record to Map
    const players = new Map<number, LocalPlayer | null>();
    Object.entries(broadcast.players).forEach(([seatStr, bp]) => {
      const seat = Number.parseInt(seatStr, 10);
      if (bp) {
        players.set(seat, {
          uid: bp.uid,
          seatNumber: bp.seatNumber,
          displayName: bp.displayName,
          avatarUrl: bp.avatarUrl,
          role: bp.role ?? null,
          hasViewedRole: bp.hasViewedRole,
        });
        // Track my seat
        if (bp.uid === myUid) {
          mySeat = seat;
        }
      } else {
        players.set(seat, null);
      }
    });

    // Rebuild wolfVotes from wolfVoteStatus
    // Players need to know who has voted to update imActioner state
    // Use -999 as placeholder target (players don't see actual targets)
    const wolfVotes = new Map<number, number>();
    if (broadcast.wolfVoteStatus) {
      for (const [seatStr, hasVoted] of Object.entries(broadcast.wolfVoteStatus)) {
        if (hasVoted) {
          wolfVotes.set(Number.parseInt(seatStr, 10), -999);
        }
      }
    }

    const state: LocalGameState = {
      roomCode: broadcast.roomCode,
      hostUid: broadcast.hostUid,
      status: broadcast.status as GameStatus,
      template,
      players,
      actions: new Map(), // Players don't see actions
      wolfVotes,
      currentActionerIndex: broadcast.currentActionerIndex,
      isAudioPlaying: broadcast.isAudioPlaying,
      lastNightDeaths: [], // Will be set by NIGHT_END message
      nightmareBlockedSeat: broadcast.nightmareBlockedSeat,
      wolfKillDisabled: broadcast.wolfKillDisabled,
      currentNightResults: {}, // Players don't see currentNightResults (Host-only state)
      // Role-specific context
      witchContext: broadcast.witchContext,
      seerReveal: broadcast.seerReveal,
      psychicReveal: broadcast.psychicReveal,
      gargoyleReveal: broadcast.gargoyleReveal,
      wolfRobotReveal: broadcast.wolfRobotReveal,
      confirmStatus: broadcast.confirmStatus,
      actionRejected: broadcast.actionRejected,
    };

    return { state, mySeat };
  }

  // ===========================================================================
  // Listener Notification
  // ===========================================================================

  /**
   * Notify all listeners of state change.
   * Called internally by update methods, but also exposed for external callers
   * (e.g., GameStateService during migration).
   */
  notifyListeners(): void {
    if (!this.state) return;

    // Create a shallow copy so React detects the change
    const stateCopy = { ...this.state };
    this.listeners.forEach((listener) => {
      try {
        listener(stateCopy);
      } catch (err) {
        hostLog.error('[StateManager] Listener error:', err);
      }
    });
  }

  // ===========================================================================
  // Seat/Role Query Helpers
  // ===========================================================================

  /**
   * Find the seat number for a specific role.
   * Returns -1 if role not found.
   */
  findSeatByRole(role: RoleId): number {
    if (!this.state) return -1;

    for (const [seat, player] of this.state.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  }

  /**
   * Get all seats for a specific role.
   * For 'wolf', includes all wolf-type roles.
   */
  getSeatsForRole(role: RoleId): number[] {
    if (!this.state) return [];

    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role === role) {
        seats.push(seat);
      }
      // For wolf role, include all wolves
      if (role === 'wolf' && player?.role && isWolfRole(player.role)) {
        if (!seats.includes(seat)) {
          seats.push(seat);
        }
      }
    });
    return seats.sort((a, b) => a - b);
  }

  /**
   * Build a seat -> roleId map for resolver context.
   */
  buildRoleMap(): ReadonlyMap<number, RoleId> {
    if (!this.state) return new Map();

    const roleMap = new Map<number, RoleId>();
    this.state.players.forEach((player, seat) => {
      if (player?.role) {
        roleMap.set(seat, player.role);
      }
    });
    return roleMap;
  }

  // ===========================================================================
  // Player State Updates
  // ===========================================================================

  /**
   * Assign shuffled roles to all seated players.
   * Updates status to 'assigned' after assignment.
   */
  assignRolesToPlayers(shuffledRoles: RoleId[]): void {
    if (!this.state) return;

    let i = 0;
    this.state.players.forEach((player, _seat) => {
      if (player) {
        player.role = shuffledRoles[i];
        player.hasViewedRole = false;
        i++;
      }
    });

    this.state.status = GameStatus.assigned;
    this.notifyListeners();
  }

  /**
   * Mark a player as having viewed their role.
   * If all players have viewed, status changes to 'ready'.
   *
   * @returns true if all players have now viewed their roles
   */
  markPlayerViewedRole(seat: number): boolean {
    if (!this.state) return false;

    const player = this.state.players.get(seat);
    if (!player) return false;

    player.hasViewedRole = true;

    // Check if all players have viewed
    const allViewed = Array.from(this.state.players.values())
      .filter((p): p is LocalPlayer => p !== null)
      .every((p) => p.hasViewedRole);

    if (allViewed) {
      this.state.status = GameStatus.ready;
    }

    this.notifyListeners();
    return allViewed;
  }

  /**
   * Update a player's seat info (for join/leave operations).
   */
  setPlayerAtSeat(seat: number, player: LocalPlayer | null): void {
    if (!this.state) return;
    this.state.players.set(seat, player);
    this.notifyListeners();
  }

  /**
   * Update seating status based on whether all seats are filled.
   */
  updateSeatingStatus(): void {
    if (!this.state) return;

    const allSeated = Array.from(this.state.players.values()).every((p) => p !== null);
    this.state.status = allSeated ? GameStatus.seated : GameStatus.unseated;
    this.notifyListeners();
  }

  /**
   * Update template and resize players map accordingly.
   * Keeps existing players if their seats still exist.
   */
  updateTemplate(newTemplate: GameTemplate): void {
    if (!this.state) return;

    // Reset players map to match new template size
    const oldPlayers = this.state.players;
    const newPlayers = new Map<number, LocalPlayer | null>();
    for (let i = 0; i < newTemplate.numberOfPlayers; i++) {
      // Keep existing players if seat still exists
      const existingPlayer = oldPlayers.get(i);
      newPlayers.set(i, existingPlayer ?? null);
    }

    this.state.template = newTemplate;
    this.state.players = newPlayers;

    // Recalculate status based on seating
    const allSeated = Array.from(this.state.players.values()).every((p) => p !== null);
    this.state.status = allSeated ? GameStatus.seated : GameStatus.unseated;

    this.notifyListeners();
  }

  // ===========================================================================
  // Map Operations (actions, wolfVotes)
  // ===========================================================================

  /**
   * Record an action for a role.
   */
  recordAction(role: RoleId, action: RoleAction): void {
    if (!this.state) return;
    this.state.actions.set(role, action);
    this.notifyListeners();
  }

  /**
   * Check if an action has been recorded for a role.
   */
  hasAction(role: RoleId): boolean {
    return this.state?.actions.has(role) ?? false;
  }

  /**
   * Record a wolf vote.
   */
  recordWolfVote(seat: number, target: number): void {
    if (!this.state) return;
    this.state.wolfVotes.set(seat, target);
    this.notifyListeners();
  }

  /**
   * Clear all wolf votes (between roles or at night end).
   */
  clearWolfVotes(): void {
    if (!this.state) return;
    this.state.wolfVotes = new Map();
    this.notifyListeners();
  }
}

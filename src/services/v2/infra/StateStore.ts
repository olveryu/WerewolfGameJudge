/**
 * StateStore - Pure State Storage
 *
 * Single source of truth for game state.
 * Responsibilities:
 * - Store LocalGameState
 * - Manage state revision
 * - Notify listeners on change
 * - Convert between LocalGameState and BroadcastGameState
 *
 * NOT responsible for:
 * - Business logic (handled by Engines)
 * - Broadcasting (handled by Transport)
 * - Persistence (handled by Storage)
 *
 * @module v2/infra/StateStore
 */

import { createTemplateFromRoles } from '../../../models/Template';
import { isWolfRole, doesRoleParticipateInWolfVote } from '../../../models/roles';
import type { RoleId } from '../../../models/roles';
import { hostLog, playerLog } from '../../../utils/logger';

import type { LocalGameState, LocalPlayer, GameStateListener } from '../types/GameState';
import { GameStatus } from '../types/GameState';
import type { BroadcastGameState, BroadcastPlayer } from '../../core/BroadcastService';

// =============================================================================
// Types
// =============================================================================

export interface StateStoreConfig {
  /**
   * Callback triggered after each state update.
   * Used to trigger broadcast and persistence.
   */
  onStateChange?: (state: BroadcastGameState, revision: number) => void;
}

export type StateUpdater = (current: LocalGameState) => Partial<LocalGameState>;

// =============================================================================
// StateStore
// =============================================================================

export class StateStore {
  private state: LocalGameState | null = null;
  private revision: number = 0;
  private readonly listeners: Set<GameStateListener> = new Set();
  private readonly config: StateStoreConfig;

  constructor(config: StateStoreConfig = {}) {
    this.config = config;
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.state;
  }

  getRevision(): number {
    return this.revision;
  }

  hasState(): boolean {
    return this.state !== null;
  }

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  /**
   * Initialize state (baseline, revision = 0)
   */
  initialize(state: LocalGameState): void {
    this.state = state;
    this.revision = 0;
    this.notifyListeners();
    hostLog.debug('[StateStore] Initialized');
  }

  /**
   * Update state with an updater function.
   * Increments revision, notifies listeners, triggers callback.
   */
  update(updater: StateUpdater): void {
    if (!this.state) {
      throw new Error('[StateStore] Cannot update: state not initialized');
    }

    const updates = updater(this.state);
    this.state = { ...this.state, ...updates };
    this.revision++;

    this.notifyListeners();

    if (this.config.onStateChange) {
      this.config.onStateChange(this.toBroadcastState(), this.revision);
    }
  }

  /**
   * Reset state (when leaving room)
   */
  reset(): void {
    this.state = null;
    this.revision = 0;
    this.listeners.clear();
    hostLog.debug('[StateStore] Reset');
  }

  /**
   * Set revision directly (for sync scenarios)
   */
  setRevision(rev: number): void {
    this.revision = rev;
  }

  // ===========================================================================
  // Subscription
  // ===========================================================================

  /**
   * Subscribe to state changes.
   * @returns Unsubscribe function
   */
  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);

    // Immediately notify with current state
    if (this.state) {
      try {
        listener({ ...this.state });
      } catch (err) {
        hostLog.error('[StateStore] Listener error:', err);
      }
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners(): void {
    if (!this.state) return;
    const copy = { ...this.state };
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        hostLog.error('[StateStore] Listener error:', err);
      }
    });
  }

  // ===========================================================================
  // Broadcast Conversion
  // ===========================================================================

  /**
   * Convert LocalGameState to BroadcastGameState
   */
  toBroadcastState(): BroadcastGameState {
    if (!this.state) {
      throw new Error('[StateStore] Cannot convert: state not initialized');
    }

    const players: Record<number, BroadcastPlayer | null> = {};
    this.state.players.forEach((p, seat) => {
      players[seat] = p
        ? {
            uid: p.uid,
            seatNumber: p.seatNumber,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            role: p.role,
            hasViewedRole: p.hasViewedRole,
          }
        : null;
    });

    // Build wolf vote status
    const wolfVoteStatus: Record<number, boolean> = {};
    this.getVotingWolfSeats().forEach((seat) => {
      wolfVoteStatus[seat] = this.state!.wolfVotes.has(seat);
    });

    // Get nightmare blocked seat
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
   * Apply state from Host broadcast.
   * Returns whether update was applied and the player's seat.
   */
  applyBroadcastState(
    broadcast: BroadcastGameState,
    myUid: string | null,
  ): { applied: boolean; mySeat: number | null } {
    const template = createTemplateFromRoles(broadcast.templateRoles);
    let mySeat: number | null = null;

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
        if (bp.uid === myUid) mySeat = seat;
      } else {
        players.set(seat, null);
      }
    });

    // Rebuild wolfVotes from status
    const wolfVotes = new Map<number, number>();
    if (broadcast.wolfVoteStatus) {
      for (const [seatStr, hasVoted] of Object.entries(broadcast.wolfVoteStatus)) {
        if (hasVoted) {
          wolfVotes.set(Number.parseInt(seatStr, 10), -999);
        }
      }
    }

    this.state = {
      roomCode: broadcast.roomCode,
      hostUid: broadcast.hostUid,
      status: broadcast.status as GameStatus,
      template,
      players,
      actions: new Map(),
      wolfVotes,
      currentActionerIndex: broadcast.currentActionerIndex,
      isAudioPlaying: broadcast.isAudioPlaying,
      lastNightDeaths: [],
      nightmareBlockedSeat: broadcast.nightmareBlockedSeat,
      wolfKillDisabled: broadcast.wolfKillDisabled,
      currentNightResults: {},
      witchContext: broadcast.witchContext,
      seerReveal: broadcast.seerReveal,
      psychicReveal: broadcast.psychicReveal,
      gargoyleReveal: broadcast.gargoyleReveal,
      wolfRobotReveal: broadcast.wolfRobotReveal,
      confirmStatus: broadcast.confirmStatus,
      actionRejected: broadcast.actionRejected,
    };

    this.notifyListeners();
    playerLog.debug(`[StateStore] Applied broadcast, mySeat=${mySeat}`);
    return { applied: true, mySeat };
  }

  // ===========================================================================
  // Query Helpers
  // ===========================================================================

  /**
   * Find seat by role
   */
  findSeatByRole(role: RoleId): number {
    if (!this.state) return -1;
    for (const [seat, player] of this.state.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  }

  /**
   * Get all seats for a role (includes all wolves for 'wolf')
   */
  getSeatsForRole(role: RoleId): number[] {
    if (!this.state) return [];
    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role === role) seats.push(seat);
      if (role === 'wolf' && player?.role && isWolfRole(player.role)) {
        if (!seats.includes(seat)) seats.push(seat);
      }
    });
    return seats.sort((a, b) => a - b);
  }

  /**
   * Build role map for resolver context
   */
  buildRoleMap(): ReadonlyMap<number, RoleId> {
    if (!this.state) return new Map();
    const roleMap = new Map<number, RoleId>();
    this.state.players.forEach((player, seat) => {
      if (player?.role) roleMap.set(seat, player.role);
    });
    return roleMap;
  }

  /**
   * Get seats of wolves that participate in voting
   */
  private getVotingWolfSeats(): number[] {
    if (!this.state) return [];
    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        seats.push(seat);
      }
    });
    return seats;
  }

  /**
   * Get player's role by seat
   */
  getRoleBySeat(seat: number): RoleId | null {
    return this.state?.players.get(seat)?.role ?? null;
  }

  /**
   * Check if seat is occupied
   */
  isSeatOccupied(seat: number): boolean {
    return this.state?.players.get(seat) !== null;
  }

  /**
   * Get number of players
   */
  getNumberOfPlayers(): number {
    return this.state?.template.numberOfPlayers ?? 0;
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export { GameStatus } from '../types/GameState';
export type { LocalGameState, LocalPlayer, GameStateListener } from '../types/GameState';
export type { BroadcastGameState } from '../../core/BroadcastService';

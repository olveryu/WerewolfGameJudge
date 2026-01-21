/**
 * SeatEngine - 座位管理业务逻辑
 *
 * 职责：
 * - 验证座位操作 (sit/standup)
 * - 计算座位状态变更
 * - 纯函数逻辑，无副作用
 *
 * 不做的事：
 * - 状态存储 (StateStore 职责)
 * - 网络通信 (Transport 职责)
 * - ACK 协议 (HostEngine/PlayerEngine 职责)
 */

import { type LocalGameState, type LocalPlayer, GameStatus } from '../infra/StateStore';

// =============================================================================
// Types
// =============================================================================

/** Result of a seat operation */
export interface SeatOperationResult {
  success: boolean;
  reason?: SeatFailReason;
  /** State updates to apply (if successful) */
  updates?: Partial<LocalGameState>;
}

/** Reasons for seat operation failure */
export type SeatFailReason = 'seat_taken' | 'not_seated' | 'game_in_progress' | 'seat_out_of_range';

/** Input for sit operation */
export interface SitInput {
  seat: number;
  uid: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Input for standup operation */
export interface StandupInput {
  seat: number;
  uid: string;
}

// =============================================================================
// SeatEngine
// =============================================================================

export class SeatEngine {
  // ---------------------------------------------------------------------------
  // Sit Operation
  // ---------------------------------------------------------------------------

  /**
   * Validate and compute state updates for sit operation
   *
   * @param state Current game state
   * @param input Sit operation input
   * @returns Operation result with updates if successful
   */
  sit(state: LocalGameState, input: SitInput): SeatOperationResult {
    const { seat, uid, displayName, avatarUrl } = input;

    // Validate: game must be in seating phase
    if (!this.canModifySeats(state.status)) {
      return { success: false, reason: 'game_in_progress' };
    }

    // Validate: seat must be within range (0-indexed: 0 to totalSeats-1)
    const totalSeats = state.template.roles.length;
    if (seat < 0 || seat >= totalSeats) {
      return { success: false, reason: 'seat_out_of_range' };
    }

    // Validate: seat must be available
    if (state.players.get(seat) !== null) {
      return { success: false, reason: 'seat_taken' };
    }

    // Compute updates
    const newPlayers = new Map(state.players);

    // Clear any old seats for this player
    for (const [existingSeat, player] of newPlayers.entries()) {
      if (player?.uid === uid && existingSeat !== seat) {
        newPlayers.set(existingSeat, null);
      }
    }

    // Create new player entry
    const player: LocalPlayer = {
      uid,
      seatNumber: seat,
      displayName,
      avatarUrl,
      role: null,
      hasViewedRole: false,
    };
    newPlayers.set(seat, player);

    // Compute new status
    const newStatus = this.computeStatus(newPlayers, totalSeats);

    return {
      success: true,
      updates: {
        players: newPlayers,
        status: newStatus,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Standup Operation
  // ---------------------------------------------------------------------------

  /**
   * Validate and compute state updates for standup operation
   *
   * @param state Current game state
   * @param input Standup operation input
   * @returns Operation result with updates if successful
   */
  standup(state: LocalGameState, input: StandupInput): SeatOperationResult {
    const { seat, uid } = input;

    // Validate: game must be in seating phase
    if (!this.canModifySeats(state.status)) {
      return { success: false, reason: 'game_in_progress' };
    }

    // Validate: player must be in this seat
    const player = state.players.get(seat);
    if (player?.uid !== uid) {
      return { success: false, reason: 'not_seated' };
    }

    // Compute updates
    const newPlayers = new Map(state.players);
    newPlayers.set(seat, null);

    // Compute new status
    const totalSeats = state.template.roles.length;
    const newStatus = this.computeStatus(newPlayers, totalSeats);

    return {
      success: true,
      updates: {
        players: newPlayers,
        status: newStatus,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Query Helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a seat is available
   */
  isSeatAvailable(state: LocalGameState, seat: number): boolean {
    return state.players.get(seat) === null;
  }

  /**
   * Get all occupied seats
   */
  getOccupiedSeats(state: LocalGameState): number[] {
    const seats: number[] = [];
    for (const [seat, player] of state.players.entries()) {
      if (player !== null) {
        seats.push(seat);
      }
    }
    return seats.sort((a, b) => a - b);
  }

  /**
   * Find seat by UID
   */
  findSeatByUid(state: LocalGameState, uid: string): number | null {
    for (const [seat, player] of state.players.entries()) {
      if (player?.uid === uid) {
        return seat;
      }
    }
    return null;
  }

  /**
   * Count occupied seats
   */
  getOccupiedCount(state: LocalGameState): number {
    let count = 0;
    for (const player of state.players.values()) {
      if (player !== null) {
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if seats can be modified in current status
   */
  private canModifySeats(status: GameStatus): boolean {
    return status === GameStatus.unseated || status === GameStatus.seated;
  }

  /**
   * Compute game status based on player count
   */
  private computeStatus(players: Map<number, LocalPlayer | null>, totalSeats: number): GameStatus {
    let occupiedCount = 0;
    for (const player of players.values()) {
      if (player !== null) {
        occupiedCount++;
      }
    }

    if (occupiedCount === 0) {
      return GameStatus.unseated;
    } else if (occupiedCount >= totalSeats) {
      return GameStatus.seated;
    } else {
      return GameStatus.unseated; // Partially seated still counts as unseated
    }
  }
}

export default SeatEngine;

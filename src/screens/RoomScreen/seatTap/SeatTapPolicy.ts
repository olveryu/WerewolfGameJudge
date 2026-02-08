/**
 * SeatTapPolicy.ts - Pure function strategy for seat tap decisions
 *
 * This module implements a single, testable strategy for determining
 * what should happen when a user taps a seat in RoomScreen.
 *
 * Priority order (contract):
 * 1. Audio Gate (highest) - NOOP when audio is playing during ongoing game
 * 2. DisabledReason - ALERT when seat has schema constraint violation
 * 3. Room Status - Route to SEATING_FLOW or ACTION_FLOW
 *
 * ❌ Do NOT import: services, navigation, showAlert, React
 * ✅ Allowed imports: types only
 */

// Use the re-export from models/Room for consistency with RoomScreen.tsx
// (Both point to the same enum from services/types/GameStateTypes)
import { GameStatus } from '@/models/GameStatus';

// =============================================================================
// Types
// =============================================================================

/** Result when tap should be ignored (no-op) */
export interface SeatTapResultNoop {
  kind: 'NOOP';
  reason: 'audio_playing' | 'no_game_state' | 'not_actioner' | 'other_status';
}

/** Result when an alert should be shown */
export interface SeatTapResultAlert {
  kind: 'ALERT';
  title: string;
  message: string;
}

/** Result when seating flow should be triggered */
export interface SeatTapResultSeatingFlow {
  kind: 'SEATING_FLOW';
  seatIndex: number;
}

/** Result when action flow should be triggered */
export interface SeatTapResultActionFlow {
  kind: 'ACTION_FLOW';
  seatIndex: number;
}

/** Union of all possible seat tap results */
export type SeatTapResult =
  | SeatTapResultNoop
  | SeatTapResultAlert
  | SeatTapResultSeatingFlow
  | SeatTapResultActionFlow;

/** Input context for seat tap policy decision */
export interface SeatTapPolicyInput {
  /** Current room/game status */
  roomStatus: GameStatus | undefined;
  /** Whether audio is currently playing (gate) */
  isAudioPlaying: boolean;
  /** The seat index that was tapped */
  seatIndex: number;
  /** UX-only disabled reason from SeatViewModel (e.g., "不能选择自己") */
  disabledReason?: string;
  /** Whether the current player can act (imActioner) - used for ongoing phase */
  imActioner: boolean;
  /** Whether game state exists */
  hasGameState: boolean;
}

// =============================================================================
// Policy Function
// =============================================================================

/**
 * Determine the action to take when a seat is tapped.
 *
 * This is a pure function with no side effects.
 * The caller (RoomScreen) is responsible for executing the result.
 *
 * @param input - Context needed to make the decision
 * @returns An instruction telling the caller what to do
 */
export function getSeatTapResult(input: SeatTapPolicyInput): SeatTapResult {
  const { roomStatus, isAudioPlaying, seatIndex, disabledReason, imActioner, hasGameState } = input;

  // Guard: no game state
  if (!hasGameState) {
    return { kind: 'NOOP', reason: 'no_game_state' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 1: Audio Gate (highest priority)
  // When audio is playing during ongoing game, all seat taps are no-op.
  // This prevents accidental actions and ensures audio completes.
  // ─────────────────────────────────────────────────────────────────────────
  if (roomStatus === GameStatus.ongoing && isAudioPlaying) {
    return { kind: 'NOOP', reason: 'audio_playing' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 2: DisabledReason (schema constraint violation)
  // Show alert if seat has a disabled reason (e.g., "不能选择自己")
  // ─────────────────────────────────────────────────────────────────────────
  if (disabledReason) {
    return {
      kind: 'ALERT',
      title: '不可选择',
      message: disabledReason,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 3: Room Status routing
  // ─────────────────────────────────────────────────────────────────────────

  // Seating phase: allow seat selection/leaving
  if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
    return { kind: 'SEATING_FLOW', seatIndex };
  }

  // Ongoing phase: action flow if player can act
  if (roomStatus === GameStatus.ongoing) {
    if (imActioner) {
      return { kind: 'ACTION_FLOW', seatIndex };
    }
    // Player cannot act (not their turn, already acted, etc.)
    return { kind: 'NOOP', reason: 'not_actioner' };
  }

  // Other statuses (assigned, ready, ended): no action on seat tap
  return { kind: 'NOOP', reason: 'other_status' };
}

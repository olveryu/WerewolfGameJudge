/**
 * SeatTapPolicy.ts - Pure function strategy for seat tap decisions
 *
 * This module implements a single, testable strategy for determining
 * what should happen when a user taps a seat in WerewolfRoomScreen.
 *
 * Priority order (contract):
 * 1. Audio Gate (highest) - NOOP when audio is playing during ongoing game
 * 2. DisabledReason - ALERT when seat has schema constraint violation
 * 3. Room Status - Route to SEATING_FLOW or ACTION_FLOW
 *
 * Only imports types. Does not import services, navigation, showAlert, or React.
 */

// Use the re-export from models/Room for consistency with WerewolfRoomScreen.tsx
// (Both point to the same enum from services/types/GameStateTypes)
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';

// =============================================================================
// Types
// =============================================================================

/** Result when tap should be ignored (no-op) */
interface SeatTapResultNoop {
  kind: 'NOOP';
  reason: 'audio_playing' | 'not_actioner' | 'other_status';
}

/** Result when an alert should be shown */
interface SeatTapResultAlert {
  kind: 'ALERT';
  title: string;
  message: string;
}

/** Result when seating flow should be triggered */
interface SeatTapResultSeatingFlow {
  kind: 'SEATING_FLOW';
  seat: number;
}

/** Result when action flow should be triggered */
interface SeatTapResultActionFlow {
  kind: 'ACTION_FLOW';
  seat: number;
}

/** Result when player profile card should be shown */
interface SeatTapResultViewProfile {
  kind: 'VIEW_PROFILE';
  seat: number;
  targetUserId: string;
}

/** Union of all possible seat tap results */
type SeatTapResult =
  | SeatTapResultNoop
  | SeatTapResultAlert
  | SeatTapResultSeatingFlow
  | SeatTapResultActionFlow
  | SeatTapResultViewProfile;

/** Input context for seat tap policy decision */
export interface SeatTapPolicyInput {
  /** Current room/game status */
  roomStatus: GameStatus;
  /** Whether audio is currently playing (gate) */
  isAudioPlaying: boolean;
  /** The seat index that was tapped */
  seat: number;
  /** UX-only disabled reason from SeatViewModel (e.g., "不能选择自己") */
  disabledReason?: string;
  /** Whether the current player can act (imActioner) - used for ongoing phase */
  imActioner: boolean;
  /** Whether the tapped seat is occupied by another player (not self) */
  isSeatOccupiedByOther: boolean;
  /** UID of the player occupying the tapped seat (if occupied by other) */
  targetUserId?: string;
  /** Whether the tapped seat is the current player's own occupied seat */
  isSelfSeated: boolean;
  /** UID of the current player (for self-profile) */
  myUserId?: string;
}

// =============================================================================
// Policy Function
// =============================================================================

/**
 * Determine the action to take when a seat is tapped.
 *
 * This is a pure function with no side effects.
 * The caller (WerewolfRoomScreen) is responsible for executing the result.
 *
 * @param input - Context needed to make the decision
 * @returns An instruction telling the caller what to do
 */
export function getSeatTapResult(input: SeatTapPolicyInput): SeatTapResult {
  const {
    roomStatus,
    isAudioPlaying,
    seat,
    disabledReason,
    imActioner,
    isSeatOccupiedByOther,
    targetUserId,
    isSelfSeated,
    myUserId,
  } = input;

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 1: Audio Gate (highest priority)
  // When audio is playing during ongoing game, all seat taps are no-op.
  // This prevents accidental actions and ensures audio completes.
  // ─────────────────────────────────────────────────────────────────────────
  if (roomStatus === GameStatus.Ongoing && isAudioPlaying) {
    return { kind: 'NOOP', reason: 'audio_playing' };
  }

  if (roomStatus === GameStatus.Day) {
    return { kind: 'NOOP', reason: 'other_status' };
  }

  if (roomStatus !== GameStatus.Ongoing) {
    const profileTarget =
      isSeatOccupiedByOther && targetUserId
        ? { seat, targetUserId }
        : isSelfSeated && myUserId
          ? { seat, targetUserId: myUserId }
          : null;
    const isSetup = roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated;

    if (profileTarget !== null || isSetup) {
      const roomIntent = getRoomSeatTapIntent({
        seat,
        currentSeat: isSelfSeated ? seat : null,
        target: profileTarget,
        disabledReason,
      });
      switch (roomIntent.kind) {
        case 'blocked':
          return { kind: 'ALERT', title: '不可选择', message: roomIntent.reason };
        case 'take':
        case 'move':
          return { kind: 'SEATING_FLOW', seat: roomIntent.seat };
        case 'profile':
          return {
            kind: 'VIEW_PROFILE',
            seat: roomIntent.target.seat,
            targetUserId: roomIntent.target.targetUserId,
          };
      }
    }
    if (disabledReason) {
      return { kind: 'ALERT', title: '不可选择', message: disabledReason };
    }
    return { kind: 'NOOP', reason: 'other_status' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 2: Ongoing action routing
  // ─────────────────────────────────────────────────────────────────────────
  if (disabledReason) {
    return { kind: 'ALERT', title: '不可选择', message: disabledReason };
  }
  if (imActioner) {
    return { kind: 'ACTION_FLOW', seat };
  }
  return { kind: 'NOOP', reason: 'not_actioner' };
}

/**
 * roomSeatInteraction — shared pure policy for basic seat-board taps.
 *
 * Domain games provide lifecycle status and occupant identity. The policy returns
 * UI instructions; callers execute alerts, modals, or profile cards.
 */

import type { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';

import { isRoomSeatingStatus } from './roomLifecycle';

export type RoomSeatPressResult =
  | { kind: 'VIEW_PROFILE'; seat: number; targetUserId: string }
  | { kind: 'OPEN_SEAT_OPERATION'; operationKind: 'enter' | 'move'; seat: number }
  | { kind: 'AUTH_REQUIRED' }
  | { kind: 'NOOP'; reason: 'missing_state' | 'seat_locked' };

interface GetRoomSeatPressResultParams {
  status: GameStatus | undefined;
  seat: number;
  occupantUserId: string | null;
  mySeat: number | null;
  myUserId: string | null;
}

export function getRoomSeatPressResult({
  status,
  seat,
  occupantUserId,
  mySeat,
  myUserId,
}: GetRoomSeatPressResultParams): RoomSeatPressResult {
  if (!status) return { kind: 'NOOP', reason: 'missing_state' };

  if (occupantUserId) {
    return { kind: 'VIEW_PROFILE', seat, targetUserId: occupantUserId };
  }

  if (!isRoomSeatingStatus(status)) {
    return { kind: 'NOOP', reason: 'seat_locked' };
  }

  if (!myUserId) {
    return { kind: 'AUTH_REQUIRED' };
  }

  return {
    kind: 'OPEN_SEAT_OPERATION',
    operationKind: mySeat === null ? 'enter' : 'move',
    seat,
  };
}

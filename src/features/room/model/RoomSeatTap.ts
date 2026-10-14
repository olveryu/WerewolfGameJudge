/** Game-neutral seat-tap intent shared by every room adapter. */

/** Title of every seat-tap rejection alert, in all seven games. */
export const ROOM_SEAT_TAP_BLOCKED_TITLE = '不可选择';

export type RoomSeatTapIntent<TTarget> =
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'take'; readonly seat: number }
  | { readonly kind: 'move'; readonly seat: number }
  | { readonly kind: 'profile'; readonly target: TTarget };

export interface RoomSeatTapInput<TTarget> {
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly target: TTarget | null;
  readonly disabledReason?: string;
}

/** Outcome of an in-game seat tap that no game-specific flow consumed. */
export type RoomInGameSeatTapOutcome =
  | { readonly kind: 'alert'; readonly reason: string }
  | { readonly kind: 'noop' };

/**
 * In-game seat-tap adjudication, the single implementation for every
 * room: a seat carrying a disabled reason (the one in-game case is an
 * empty seat) surfaces that reason; every other in-game tap is a
 * silent no-op. Werewolf's SeatTapPolicy consumes this inside its
 * status routing; the other rooms consume it for their non-lobby
 * branch. Lobby/setup flows stay with getRoomSeatTapIntent.
 */
export function resolveRoomInGameSeatTap(disabledReason?: string): RoomInGameSeatTapOutcome {
  if (disabledReason === undefined) return { kind: 'noop' };
  if (disabledReason.length === 0) {
    throw new Error('Room seat disabled reason must be non-empty');
  }
  return { kind: 'alert', reason: disabledReason };
}

/** Resolve shared lobby/profile semantics without executing a room capability. */
export function getRoomSeatTapIntent<TTarget>(
  input: RoomSeatTapInput<TTarget>,
): RoomSeatTapIntent<TTarget> {
  if (!Number.isSafeInteger(input.seat) || input.seat < 0) {
    throw new Error(`Room seat tap must use a non-negative safe integer: ${input.seat}`);
  }
  if (input.currentSeat !== null) {
    if (!Number.isSafeInteger(input.currentSeat) || input.currentSeat < 0) {
      throw new Error(
        `Current room seat must be a non-negative safe integer: ${input.currentSeat}`,
      );
    }
  }
  if (input.disabledReason !== undefined) {
    if (input.disabledReason.length === 0) {
      throw new Error('Room seat disabled reason must be non-empty');
    }
    return { kind: 'blocked', reason: input.disabledReason };
  }
  if (input.target !== null) {
    return { kind: 'profile', target: input.target };
  }
  return input.currentSeat === null
    ? { kind: 'take', seat: input.seat }
    : { kind: 'move', seat: input.seat };
}

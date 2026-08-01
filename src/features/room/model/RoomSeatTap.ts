/** Game-neutral seat-tap intent shared by every room adapter. */

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

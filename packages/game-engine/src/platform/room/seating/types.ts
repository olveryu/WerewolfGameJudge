/** Generic seat-map contracts used by game-specific room adapters. */

/** Anything that can sit in a seat slot; humans add a user identity. */
export interface SeatSlotOccupant {
  readonly seat: number;
}

export interface SeatOccupant extends SeatSlotOccupant {
  readonly userId: string;
}

/**
 * Sparse and dense room states share this shape. Missing keys and null values
 * both represent an empty seat; seatCount remains the authoritative range.
 */
export type SeatMap<TSeat extends SeatOccupant> = Readonly<
  Record<number, TSeat | null | undefined>
>;

export interface SeatChange<TSeat extends SeatSlotOccupant> {
  readonly seat: number;
  readonly previous: TSeat | null;
  readonly next: TSeat | null;
}

export type SeatOperationResult<TSeat extends SeatSlotOccupant> =
  | {
      readonly kind: 'accepted';
      readonly changes: readonly SeatChange<TSeat>[];
    }
  | {
      readonly kind: 'rejected';
      readonly reason: SeatOperationReason;
    };

export const SEAT_OPERATION_REASONS = {
  invalidSeat: 'invalid_seat',
  seatTaken: 'seat_taken',
  notSeated: 'not_seated',
  seatEmpty: 'seat_empty',
} as const;

export type SeatOperationReason =
  (typeof SEAT_OPERATION_REASONS)[keyof typeof SEAT_OPERATION_REASONS];

/** Generic seat-map contracts used by game-specific room adapters. */

export interface SeatOccupant {
  readonly userId: string;
  readonly seat: number;
}

/**
 * Sparse and dense room states share this shape. Missing keys and null values
 * both represent an empty seat; seatCount remains the authoritative range.
 */
export type SeatMap<TSeat extends SeatOccupant> = Readonly<
  Record<number, TSeat | null | undefined>
>;

export interface SeatChange<TSeat extends SeatOccupant> {
  readonly seat: number;
  readonly previous: TSeat | null;
  readonly next: TSeat | null;
}

export type SeatOperationResult<TSeat extends SeatOccupant> =
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

/**
 * Pure seating decision kernel.
 *
 * The kernel owns seat range, occupancy, move, leave, kick, clear, and identity
 * invariants. Game modules retain phase/authorization checks and translate the
 * resulting changes into their own reducer events.
 */

import {
  SEAT_OPERATION_REASONS,
  type SeatChange,
  type SeatMap,
  type SeatOccupant,
  type SeatOperationResult,
} from './types';

interface SeatIndex<TSeat extends SeatOccupant> {
  readonly occupantsBySeat: ReadonlyMap<number, TSeat>;
  readonly seatsByUserId: ReadonlyMap<string, number>;
}

function assertSeatCount(seatCount: number): void {
  if (!Number.isSafeInteger(seatCount) || seatCount < 0) {
    throw new Error(`Seating invariant violated: invalid seatCount ${seatCount}`);
  }
}

function isSeatInRange(seat: number, seatCount: number): boolean {
  return Number.isSafeInteger(seat) && seat >= 0 && seat < seatCount;
}

function indexSeats<TSeat extends SeatOccupant>(
  seats: SeatMap<TSeat>,
  seatCount: number,
): SeatIndex<TSeat> {
  assertSeatCount(seatCount);

  const occupantsBySeat = new Map<number, TSeat>();
  const seatsByUserId = new Map<string, number>();

  for (const [rawSeat, occupant] of Object.entries(seats)) {
    const seat = Number(rawSeat);
    if (!isSeatInRange(seat, seatCount)) {
      throw new Error(`Seating invariant violated: map contains out-of-range seat ${rawSeat}`);
    }
    if (occupant == null) continue;
    if (occupant.seat !== seat) {
      throw new Error(
        `Seating invariant violated: occupant ${occupant.userId} stores seat ${occupant.seat}, expected ${seat}`,
      );
    }
    const existingSeat = seatsByUserId.get(occupant.userId);
    if (existingSeat !== undefined) {
      throw new Error(
        `Seating invariant violated: user ${occupant.userId} occupies seats ${existingSeat} and ${seat}`,
      );
    }
    occupantsBySeat.set(seat, occupant);
    seatsByUserId.set(occupant.userId, seat);
  }

  return { occupantsBySeat, seatsByUserId };
}

function accepted<TSeat extends SeatOccupant>(
  changes: readonly SeatChange<TSeat>[],
): SeatOperationResult<TSeat> {
  return { kind: 'accepted', changes };
}

function rejected<TSeat extends SeatOccupant>(
  reason: (typeof SEAT_OPERATION_REASONS)[keyof typeof SEAT_OPERATION_REASONS],
): SeatOperationResult<TSeat> {
  return { kind: 'rejected', reason };
}

export function decideTakeSeat<TSeat extends SeatOccupant>(
  seats: SeatMap<TSeat>,
  seatCount: number,
  targetSeat: number,
  userId: string,
  createOccupant: (seat: number) => TSeat,
): SeatOperationResult<TSeat> {
  const index = indexSeats(seats, seatCount);
  if (!isSeatInRange(targetSeat, seatCount)) {
    return rejected(SEAT_OPERATION_REASONS.invalidSeat);
  }

  const targetOccupant = index.occupantsBySeat.get(targetSeat) ?? null;
  if (targetOccupant !== null && targetOccupant.userId !== userId) {
    return rejected(SEAT_OPERATION_REASONS.seatTaken);
  }

  const nextOccupant = createOccupant(targetSeat);
  if (nextOccupant.userId !== userId || nextOccupant.seat !== targetSeat) {
    throw new Error('Seating invariant violated: createOccupant returned a mismatched identity');
  }

  const changes: SeatChange<TSeat>[] = [];
  const previousSeat = index.seatsByUserId.get(userId);
  if (previousSeat !== undefined && previousSeat !== targetSeat) {
    changes.push({
      seat: previousSeat,
      previous: index.occupantsBySeat.get(previousSeat)!,
      next: null,
    });
  }
  changes.push({ seat: targetSeat, previous: targetOccupant, next: nextOccupant });
  return accepted(changes);
}

export function decideLeaveSeat<TSeat extends SeatOccupant>(
  seats: SeatMap<TSeat>,
  seatCount: number,
  userId: string,
): SeatOperationResult<TSeat> {
  const index = indexSeats(seats, seatCount);
  const seat = index.seatsByUserId.get(userId);
  if (seat === undefined) {
    return rejected(SEAT_OPERATION_REASONS.notSeated);
  }
  return accepted([{ seat, previous: index.occupantsBySeat.get(seat)!, next: null }]);
}

export function decideKickSeat<TSeat extends SeatOccupant>(
  seats: SeatMap<TSeat>,
  seatCount: number,
  targetSeat: number,
): SeatOperationResult<TSeat> {
  const index = indexSeats(seats, seatCount);
  if (!isSeatInRange(targetSeat, seatCount)) {
    return rejected(SEAT_OPERATION_REASONS.invalidSeat);
  }
  const occupant = index.occupantsBySeat.get(targetSeat);
  if (occupant === undefined) {
    return rejected(SEAT_OPERATION_REASONS.seatEmpty);
  }
  return accepted([{ seat: targetSeat, previous: occupant, next: null }]);
}

export function decideClearSeats<TSeat extends SeatOccupant>(
  seats: SeatMap<TSeat>,
  seatCount: number,
): SeatOperationResult<TSeat> {
  const index = indexSeats(seats, seatCount);
  const changes = [...index.occupantsBySeat.entries()]
    .sort(([left], [right]) => left - right)
    .map(([seat, occupant]): SeatChange<TSeat> => ({ seat, previous: occupant, next: null }));
  return accepted(changes);
}

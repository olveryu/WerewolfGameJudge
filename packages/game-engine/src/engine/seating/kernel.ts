/**
 * Generic seating kernel.
 *
 * Pure CRUD over a seat map: join/move, leave, kick, clear. The caller supplies
 * the seat count, so the same logic works for dense werewolf seats and sparse
 * fibking seats.
 */

import type { BaseSeat, SeatChange, SeatMap, SeatOpResult } from './types';
import {
  SEAT_KERNEL_INVALID_SEAT,
  SEAT_KERNEL_NOT_SEATED,
  SEAT_KERNEL_SEAT_EMPTY,
  SEAT_KERNEL_SEAT_TAKEN,
} from './types';

function isValidSeat(seat: number, numberOfSeats: number): boolean {
  return Number.isInteger(seat) && seat >= 0 && seat < numberOfSeats;
}

export function findSeatByUserId<TSeat extends BaseSeat>(
  seats: SeatMap<TSeat>,
  userId: string,
): number | null {
  for (const [seat, occupant] of Object.entries(seats)) {
    if (occupant?.userId === userId) return Number(seat);
  }
  return null;
}

export function seatJoin<TSeat extends BaseSeat>(
  seats: SeatMap<TSeat>,
  numberOfSeats: number,
  seat: number,
  userId: string,
  makeSeat: (seat: number) => TSeat,
): SeatOpResult<TSeat> {
  if (!isValidSeat(seat, numberOfSeats)) {
    return { kind: 'error', reason: SEAT_KERNEL_INVALID_SEAT };
  }

  const occupant = seats[seat];
  if (occupant && occupant.userId !== userId) {
    return { kind: 'error', reason: SEAT_KERNEL_SEAT_TAKEN };
  }

  const changes: SeatChange<TSeat>[] = [];
  const oldSeat = findSeatByUserId(seats, userId);
  if (oldSeat !== null && oldSeat !== seat) {
    changes.push({ seat: oldSeat, previous: seats[oldSeat] ?? null, value: null });
  }
  changes.push({ seat, previous: occupant ?? null, value: makeSeat(seat) });
  return { kind: 'success', changes };
}

export function seatLeave<TSeat extends BaseSeat>(
  seats: SeatMap<TSeat>,
  userId: string,
): SeatOpResult<TSeat> {
  const seat = findSeatByUserId(seats, userId);
  if (seat === null) return { kind: 'error', reason: SEAT_KERNEL_NOT_SEATED };
  return { kind: 'success', changes: [{ seat, previous: seats[seat] ?? null, value: null }] };
}

export function seatKick<TSeat extends BaseSeat>(
  seats: SeatMap<TSeat>,
  numberOfSeats: number,
  seat: number,
): SeatOpResult<TSeat> {
  if (!isValidSeat(seat, numberOfSeats)) {
    return { kind: 'error', reason: SEAT_KERNEL_INVALID_SEAT };
  }
  const occupant = seats[seat];
  if (!occupant) return { kind: 'error', reason: SEAT_KERNEL_SEAT_EMPTY };
  return { kind: 'success', changes: [{ seat, previous: occupant, value: null }] };
}

export function seatClearAll<TSeat extends BaseSeat>(seats: SeatMap<TSeat>): SeatOpResult<TSeat> {
  const changes: SeatChange<TSeat>[] = [];
  for (const [seat, occupant] of Object.entries(seats)) {
    if (occupant) changes.push({ seat: Number(seat), previous: occupant, value: null });
  }
  return { kind: 'success', changes };
}

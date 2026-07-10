import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
} from '../kernel';
import { SEAT_OPERATION_REASONS, type SeatMap, type SeatOccupant } from '../types';

interface TestSeat extends SeatOccupant {
  readonly label: string;
}

const makeSeat = (userId: string, seat: number): TestSeat => ({
  userId,
  seat,
  label: `${userId}@${seat}`,
});

describe('seating kernel', () => {
  it('takes an empty seat without materializing the seat range', () => {
    const seats: SeatMap<TestSeat> = {};

    const result = decideTakeSeat(seats, 1_000_000, 999_999, 'u1', (seat) => makeSeat('u1', seat));

    expect(result).toEqual({
      kind: 'accepted',
      changes: [
        {
          seat: 999_999,
          previous: null,
          next: makeSeat('u1', 999_999),
        },
      ],
    });
  });

  it('moves a user by clearing the old seat before taking the new seat', () => {
    const seats: SeatMap<TestSeat> = { 1: makeSeat('u1', 1) };

    const result = decideTakeSeat(seats, 8, 6, 'u1', (seat) => makeSeat('u1', seat));

    expect(result).toEqual({
      kind: 'accepted',
      changes: [
        { seat: 1, previous: makeSeat('u1', 1), next: null },
        { seat: 6, previous: null, next: makeSeat('u1', 6) },
      ],
    });
  });

  it('refreshes the occupant payload when taking the same seat', () => {
    const seats: SeatMap<TestSeat> = { 2: makeSeat('u1', 2) };
    const refreshed = { ...makeSeat('u1', 2), label: 'updated' };

    const result = decideTakeSeat(seats, 4, 2, 'u1', () => refreshed);

    expect(result).toEqual({
      kind: 'accepted',
      changes: [{ seat: 2, previous: makeSeat('u1', 2), next: refreshed }],
    });
  });

  it('rejects an occupied target without producing changes', () => {
    const seats: SeatMap<TestSeat> = { 0: makeSeat('u2', 0) };

    expect(decideTakeSeat(seats, 4, 0, 'u1', (seat) => makeSeat('u1', seat))).toEqual({
      kind: 'rejected',
      reason: SEAT_OPERATION_REASONS.seatTaken,
    });
  });

  it.each([-1, 4, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid target seat %s',
    (targetSeat) => {
      expect(decideTakeSeat({}, 4, targetSeat, 'u1', (seat) => makeSeat('u1', seat))).toEqual({
        kind: 'rejected',
        reason: SEAT_OPERATION_REASONS.invalidSeat,
      });
    },
  );

  it('leaves the seat owned by the requested user', () => {
    const seats: SeatMap<TestSeat> = { 3: makeSeat('u1', 3) };

    expect(decideLeaveSeat(seats, 5, 'u1')).toEqual({
      kind: 'accepted',
      changes: [{ seat: 3, previous: makeSeat('u1', 3), next: null }],
    });
    expect(decideLeaveSeat(seats, 5, 'missing')).toEqual({
      kind: 'rejected',
      reason: SEAT_OPERATION_REASONS.notSeated,
    });
  });

  it('kicks an occupied seat and rejects an empty seat', () => {
    const seats: SeatMap<TestSeat> = { 1: makeSeat('u1', 1) };

    expect(decideKickSeat(seats, 3, 1)).toEqual({
      kind: 'accepted',
      changes: [{ seat: 1, previous: makeSeat('u1', 1), next: null }],
    });
    expect(decideKickSeat(seats, 3, 2)).toEqual({
      kind: 'rejected',
      reason: SEAT_OPERATION_REASONS.seatEmpty,
    });
  });

  it('clears occupied sparse seats in numeric order', () => {
    const seats: SeatMap<TestSeat> = {
      7: makeSeat('u7', 7),
      2: makeSeat('u2', 2),
      5: null,
    };

    expect(decideClearSeats(seats, 10)).toEqual({
      kind: 'accepted',
      changes: [
        { seat: 2, previous: makeSeat('u2', 2), next: null },
        { seat: 7, previous: makeSeat('u7', 7), next: null },
      ],
    });
  });

  it('resolves a user seat through the same invariant-checked index', () => {
    const seats: SeatMap<TestSeat> = {
      1: makeSeat('u1', 1),
      3: makeSeat('u3', 3),
    };

    expect(findSeatByUserId(seats, 4, 'u3')).toBe(3);
    expect(findSeatByUserId(seats, 4, 'missing')).toBeNull();
  });

  it('fails fast when one user occupies multiple seats', () => {
    const seats: SeatMap<TestSeat> = {
      0: makeSeat('u1', 0),
      1: makeSeat('u1', 1),
    };

    expect(() => decideClearSeats(seats, 2)).toThrow(
      'Seating invariant violated: user u1 occupies seats 0 and 1',
    );
  });

  it('fails fast when an occupant stores a different seat number', () => {
    const seats: SeatMap<TestSeat> = { 0: makeSeat('u1', 1) };

    expect(() => decideLeaveSeat(seats, 2, 'u1')).toThrow(
      'Seating invariant violated: occupant u1 stores seat 1, expected 0',
    );
  });

  it('fails fast when createOccupant returns a different identity', () => {
    expect(() => decideTakeSeat({}, 2, 1, 'u1', () => makeSeat('u2', 1))).toThrow(
      'Seating invariant violated: createOccupant returned a mismatched identity',
    );
  });
});

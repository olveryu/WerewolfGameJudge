import { describe, expect, it } from 'vitest';

import {
  haveAllHumansViewed,
  type IdentityViewingParticipant,
  listUnviewedSeats,
  markSeatViewed,
} from '../identityViewing';

const participants: readonly IdentityViewingParticipant[] = [
  { seat: 0, isBot: false },
  { seat: 1, isBot: false },
  { seat: 2, isBot: true },
  { seat: 3, isBot: false },
];

describe('markSeatViewed', () => {
  it('adds a seat and keeps the set sorted', () => {
    expect(markSeatViewed([], 3)).toEqual([3]);
    expect(markSeatViewed([3], 1)).toEqual([1, 3]);
    expect(markSeatViewed([1, 3], 2)).toEqual([1, 2, 3]);
  });

  it('is idempotent and returns the same array when the seat is already viewed', () => {
    const viewed = [1, 3];
    expect(markSeatViewed(viewed, 3)).toBe(viewed);
  });

  it('does not mutate the input array when adding a seat', () => {
    const viewed = [1, 3];
    markSeatViewed(viewed, 2);
    expect(viewed).toEqual([1, 3]);
  });
});

describe('listUnviewedSeats', () => {
  it('returns the participants missing from the viewed set, in order', () => {
    expect(listUnviewedSeats(participants, [0, 3]).map((p) => p.seat)).toEqual([1, 2]);
    expect(listUnviewedSeats(participants, [0, 1, 2, 3])).toEqual([]);
    expect(listUnviewedSeats(participants, []).map((p) => p.seat)).toEqual([0, 1, 2, 3]);
  });
});

describe('haveAllHumansViewed', () => {
  it('is true when every human viewed, even if a bot has not', () => {
    expect(haveAllHumansViewed(participants, [0, 1, 3])).toBe(true);
  });

  it('is false while any human has not viewed', () => {
    expect(haveAllHumansViewed(participants, [0, 1])).toBe(false);
    expect(haveAllHumansViewed(participants, [])).toBe(false);
  });

  it('is true for an empty participant list', () => {
    expect(haveAllHumansViewed([], [])).toBe(true);
  });

  it('is true when every participant is a bot', () => {
    expect(
      haveAllHumansViewed(
        [
          { seat: 0, isBot: true },
          { seat: 1, isBot: true },
        ],
        [],
      ),
    ).toBe(true);
  });
});

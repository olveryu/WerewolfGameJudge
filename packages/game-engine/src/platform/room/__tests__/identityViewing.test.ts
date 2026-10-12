import { describe, expect, it } from 'vitest';

import {
  haveAllViewed,
  type IdentityViewingParticipant,
  listUnviewedBotSeats,
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

describe('haveAllViewed', () => {
  it('is true only when every participant, bots included, has viewed', () => {
    expect(haveAllViewed(participants, [0, 1, 2, 3])).toBe(true);
    expect(haveAllViewed(participants, [0, 1, 3])).toBe(false);
  });

  it('is true for an empty participant list', () => {
    expect(haveAllViewed([], [])).toBe(true);
  });
});

describe('listUnviewedBotSeats', () => {
  it('returns only unviewed bot participants, in order', () => {
    expect(listUnviewedBotSeats(participants, []).map((p) => p.seat)).toEqual([2]);
    expect(listUnviewedBotSeats(participants, [2])).toEqual([]);
    expect(listUnviewedBotSeats(participants, [0, 1, 3]).map((p) => p.seat)).toEqual([2]);
  });
});

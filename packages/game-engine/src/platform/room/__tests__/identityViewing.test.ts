import { describe, expect, it } from 'vitest';

import { commit, type Decision, type GameEvent, reject } from '../../engine';
import {
  buildIdentityViewingParticipants,
  buildRosterViewingParticipants,
  decideMarkBotsViewed,
  haveAllViewed,
  type IdentityViewingParticipant,
  listUnviewedBotSeats,
  listUnviewedSeats,
  markSeatViewed,
  planMarkBotsViewed,
} from '../identityViewing';
import { botSeatOccupant, type RosterMap, type SeatOccupant } from '../seating';

interface TestSeat extends SeatOccupant {
  readonly label: string;
}

const human = (seat: number, userId: string): TestSeat => ({ seat, userId, label: userId });

const roster: RosterMap<TestSeat> = {
  0: human(0, 'host'),
  1: botSeatOccupant(1),
  2: null,
  3: human(3, 'guest'),
  4: botSeatOccupant(4),
};

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

describe('buildIdentityViewingParticipants', () => {
  it('pairs each given seat with its roster bot flag, in the order given', () => {
    expect(buildIdentityViewingParticipants(roster, [4, 0, 1])).toEqual([
      { seat: 4, isBot: true },
      { seat: 0, isBot: false },
      { seat: 1, isBot: true },
    ]);
  });

  it('treats seats missing from the roster as human', () => {
    expect(buildIdentityViewingParticipants(roster, [2])).toEqual([{ seat: 2, isBot: false }]);
  });
});

describe('buildRosterViewingParticipants', () => {
  it('lists every occupied seat ascending with its bot flag', () => {
    expect(buildRosterViewingParticipants(roster, 5)).toEqual([
      { seat: 0, isBot: false },
      { seat: 1, isBot: true },
      { seat: 3, isBot: false },
      { seat: 4, isBot: true },
    ]);
  });

  it('stops at numberOfPlayers even when the roster holds more seats', () => {
    expect(buildRosterViewingParticipants(roster, 2)).toEqual([
      { seat: 0, isBot: false },
      { seat: 1, isBot: true },
    ]);
  });
});

describe('planMarkBotsViewed', () => {
  it('rejects the plan when no bot seats participate at all', () => {
    const humansOnly = participants.filter((participant) => !participant.isBot);
    expect(planMarkBotsViewed(humansOnly, [])).toEqual({ kind: 'noBotSeats' });
    expect(planMarkBotsViewed([], [])).toEqual({ kind: 'noBotSeats' });
  });

  it('is a no-op when every bot seat is already marked', () => {
    expect(planMarkBotsViewed(participants, [2])).toEqual({ kind: 'noop' });
  });

  it('marks exactly the unviewed bot seats, in participant order', () => {
    const withTwoBots: readonly IdentityViewingParticipant[] = [
      { seat: 0, isBot: false },
      { seat: 2, isBot: true },
      { seat: 5, isBot: true },
    ];
    expect(planMarkBotsViewed(withTwoBots, [5])).toEqual({ kind: 'mark', seats: [2] });
    expect(planMarkBotsViewed(withTwoBots, [])).toEqual({ kind: 'mark', seats: [2, 5] });
  });
});

describe('decideMarkBotsViewed', () => {
  interface ViewedEvent extends GameEvent {
    readonly type: 'test.role.viewed';
    readonly seat: number;
  }

  const decide = (input: {
    readonly gateRejection: Decision<ViewedEvent, never> | null;
    readonly participants: readonly IdentityViewingParticipant[];
    readonly viewedSeats: readonly number[];
  }) =>
    decideMarkBotsViewed<ViewedEvent, never>({
      gateRejection: input.gateRejection,
      participants: input.participants,
      viewedSeats: input.viewedSeats,
      noBotSeatsReason: 'test_no_bot_seats',
      buildViewedEvent: (seat) => ({ type: 'test.role.viewed', seat }),
      commit: (events) => commit({ events }),
    });

  it('returns the gate rejection untouched', () => {
    const gateRejection = reject<ViewedEvent, never>('test_gate');
    expect(decide({ gateRejection, participants, viewedSeats: [] })).toBe(gateRejection);
  });

  it('rejects with the injected reason when there are no bot seats', () => {
    const humansOnly = participants.filter((participant) => !participant.isBot);
    expect(decide({ gateRejection: null, participants: humansOnly, viewedSeats: [] })).toEqual(
      reject('test_no_bot_seats'),
    );
  });

  it('commits no events when every bot seat is already marked', () => {
    expect(decide({ gateRejection: null, participants, viewedSeats: [2] })).toEqual(
      commit<ViewedEvent, never>({ events: [] }),
    );
  });

  it('commits one viewed event per unviewed bot seat', () => {
    expect(decide({ gateRejection: null, participants, viewedSeats: [] })).toEqual(
      commit<ViewedEvent, never>({ events: [{ type: 'test.role.viewed', seat: 2 }] }),
    );
  });
});

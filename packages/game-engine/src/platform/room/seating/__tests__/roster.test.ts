import {
  applyRosterChanges,
  botSeatOccupant,
  countOccupiedSeats,
  decideRosterClearSeats,
  decideRosterFillBots,
  decideRosterKickSeat,
  decideRosterLeaveSeat,
  decideRosterTakeSeat,
  findRosterSeatByUserId,
  getBotSeats,
  getHumanSeatMap,
  hasOccupantAtOrBeyond,
  isBotOccupant,
  isBotSeat,
  type RosterMap,
  type SeatOccupant,
} from '../index';

interface TestSeat extends SeatOccupant {
  readonly label: string;
}

const human = (seat: number, userId: string): TestSeat => ({ seat, userId, label: userId });
const createOccupant =
  (userId: string) =>
  (seat: number): TestSeat =>
    human(seat, userId);

const mixedRoster = (): RosterMap<TestSeat> => ({
  0: human(0, 'alice'),
  1: botSeatOccupant(1),
  3: human(3, 'bob'),
});

describe('roster selectors', () => {
  it('reports bot seats, occupancy, and range violations from one map', () => {
    const roster = mixedRoster();
    expect(getBotSeats(roster)).toEqual([1]);
    expect(isBotOccupant(roster[1])).toBe(true);
    expect(isBotOccupant(roster[0])).toBe(false);
    expect(isBotOccupant(null)).toBe(false);
    expect(isBotSeat(roster, 1)).toBe(true);
    expect(isBotSeat(roster, 0)).toBe(false);
    expect(isBotSeat(roster, 2)).toBe(false);
    expect(countOccupiedSeats(roster)).toBe(3);
    expect(hasOccupantAtOrBeyond(roster, 4)).toBe(false);
    expect(hasOccupantAtOrBeyond(roster, 3)).toBe(true);
    expect(findRosterSeatByUserId(roster, 4, 'bob')).toBe(3);
    expect(findRosterSeatByUserId(roster, 4, 'nobody')).toBeNull();
  });

  it('projects humans only and fails fast on a corrupt bot marker', () => {
    expect(Object.keys(getHumanSeatMap(mixedRoster(), 4))).toEqual(['0', '3']);
    const corrupt: RosterMap<TestSeat> = { 2: { seat: 9, kind: 'bot' } };
    expect(() => getHumanSeatMap(corrupt, 4)).toThrow(/invariant/);
  });
});

describe('decideRosterTakeSeat', () => {
  it('takes an empty seat', () => {
    const result = decideRosterTakeSeat(mixedRoster(), 4, 2, 'carol', createOccupant('carol'));
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.changes).toEqual([{ seat: 2, previous: null, next: human(2, 'carol') }]);
  });

  it('rejects a bot seat: bots occupy their seat like any player', () => {
    const roster = mixedRoster();
    const result = decideRosterTakeSeat(roster, 4, 1, 'carol', createOccupant('carol'));
    expect(result).toEqual({ kind: 'rejected', reason: 'seat_taken' });
    expect(getBotSeats(roster)).toEqual([1]);
  });

  it('rejects a seat held by another human', () => {
    const result = decideRosterTakeSeat(mixedRoster(), 4, 3, 'carol', createOccupant('carol'));
    expect(result).toEqual({ kind: 'rejected', reason: 'seat_taken' });
  });

  it('rejects a move onto a bot seat, keeping the current seat', () => {
    const result = decideRosterTakeSeat(mixedRoster(), 4, 1, 'alice', createOccupant('alice'));
    expect(result).toEqual({ kind: 'rejected', reason: 'seat_taken' });
  });

  it('refreshes the occupant when a user re-takes their own seat', () => {
    const result = decideRosterTakeSeat(mixedRoster(), 4, 0, 'alice', createOccupant('alice'));
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.changes).toEqual([
      { seat: 0, previous: human(0, 'alice'), next: human(0, 'alice') },
    ]);
  });

  it('fails fast on corrupt human entries in any decision path', () => {
    const duplicated: RosterMap<TestSeat> = { 0: human(0, 'alice'), 1: human(1, 'alice') };
    expect(() => decideRosterTakeSeat(duplicated, 4, 2, 'carol', createOccupant('carol'))).toThrow(
      /invariant/,
    );
    const misplaced: RosterMap<TestSeat> = { 0: human(2, 'alice') };
    expect(() => decideRosterFillBots(misplaced, 4)).toThrow(/invariant/);
  });
});

describe('decideRosterLeaveSeat / decideRosterKickSeat', () => {
  it('leaves by user identity and rejects users without a seat', () => {
    const roster = mixedRoster();
    const left = decideRosterLeaveSeat(roster, 4, 'alice');
    expect(left).toEqual({
      kind: 'accepted',
      changes: [{ seat: 0, previous: human(0, 'alice'), next: null }],
    });
    expect(decideRosterLeaveSeat(roster, 4, 'nobody')).toEqual({
      kind: 'rejected',
      reason: 'not_seated',
    });
  });

  it('kicks humans and bots alike, and rejects empty or invalid seats', () => {
    const roster = mixedRoster();
    const kickBot = decideRosterKickSeat(roster, 4, 1);
    expect(kickBot).toEqual({
      kind: 'accepted',
      changes: [{ seat: 1, previous: botSeatOccupant(1), next: null }],
    });
    if (kickBot.kind === 'accepted') {
      const after = applyRosterChanges(roster, kickBot.changes);
      expect(getBotSeats(after)).toEqual([]);
      expect(isBotSeat(after, 1)).toBe(false);
    }
    expect(decideRosterKickSeat(roster, 4, 0)).toEqual({
      kind: 'accepted',
      changes: [{ seat: 0, previous: human(0, 'alice'), next: null }],
    });
    expect(decideRosterKickSeat(roster, 4, 2)).toEqual({
      kind: 'rejected',
      reason: 'seat_empty',
    });
    expect(decideRosterKickSeat(roster, 4, 9)).toEqual({
      kind: 'rejected',
      reason: 'invalid_seat',
    });
  });

  it('fails fast when kicking a seat whose bot marker is corrupt', () => {
    const corrupt: RosterMap<TestSeat> = { 2: { seat: 9, kind: 'bot' } };
    expect(() => decideRosterKickSeat(corrupt, 4, 2)).toThrow(/invariant/);
  });

  it('never revives a bot: kick a bot, sit there, leave — the seat stays empty', () => {
    let roster = mixedRoster();
    const kick = decideRosterKickSeat(roster, 4, 1);
    if (kick.kind !== 'accepted') throw new Error('expected kick accepted');
    roster = applyRosterChanges(roster, kick.changes);
    const take = decideRosterTakeSeat(roster, 4, 1, 'carol', createOccupant('carol'));
    if (take.kind !== 'accepted') throw new Error('expected take accepted');
    roster = applyRosterChanges(roster, take.changes);
    const leave = decideRosterLeaveSeat(roster, 4, 'carol');
    if (leave.kind !== 'accepted') throw new Error('expected leave accepted');
    roster = applyRosterChanges(roster, leave.changes);
    expect(roster[1]).toBeUndefined();
    expect(getBotSeats(roster)).toEqual([]);
  });
});

describe('decideRosterFillBots / decideRosterClearSeats', () => {
  it('fills only the empty seats in range', () => {
    const result = decideRosterFillBots(mixedRoster(), 4);
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.changes).toEqual([{ seat: 2, previous: null, next: botSeatOccupant(2) }]);
    const full = applyRosterChanges(mixedRoster(), result.changes);
    expect(getBotSeats(full)).toEqual([1, 2]);
    expect(decideRosterFillBots(full, 4)).toEqual({ kind: 'accepted', changes: [] });
  });

  it('clears humans and bots in seat order, reporting each previous occupant', () => {
    const result = decideRosterClearSeats(mixedRoster(), 4);
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.changes).toEqual([
      { seat: 0, previous: human(0, 'alice'), next: null },
      { seat: 1, previous: botSeatOccupant(1), next: null },
      { seat: 3, previous: human(3, 'bob'), next: null },
    ]);
    expect(countOccupiedSeats(applyRosterChanges(mixedRoster(), result.changes))).toBe(0);
  });

  it('fails fast when filling with a seat count below the occupied range', () => {
    expect(() => decideRosterFillBots(mixedRoster(), 2)).toThrow(/invariant/);
  });
});

describe('applyRosterChanges', () => {
  it('does not mutate the input roster', () => {
    const roster = mixedRoster();
    const result = decideRosterFillBots(roster, 4);
    if (result.kind !== 'accepted') throw new Error('expected accepted');
    applyRosterChanges(roster, result.changes);
    expect(getBotSeats(roster)).toEqual([1]);
  });
});

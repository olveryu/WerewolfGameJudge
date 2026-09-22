/** Undercover distribution and victory contracts, independent of transport and UI. */

import { getUndercoverRoleCounts, getUndercoverWinner, type UndercoverRole } from '../domain/rules';

describe('Undercover rules', () => {
  it.each([
    [4, 1],
    [6, 1],
    [7, 2],
    [9, 2],
    [10, 3],
    [12, 3],
  ])('assigns %i players with %i undercover seats', (numberOfPlayers, undercover) => {
    expect(getUndercoverRoleCounts(numberOfPlayers, false)).toEqual({
      civilian: numberOfPlayers - undercover,
      undercover,
      blank: 0,
    });
  });

  it('replaces one civilian with a blank', () => {
    expect(getUndercoverRoleCounts(8, true)).toEqual({ civilian: 5, undercover: 2, blank: 1 });
  });

  it.each([3, 13, 4.5, Number.NaN])('rejects invalid player count %s', (numberOfPlayers) => {
    expect(() => getUndercoverRoleCounts(numberOfPlayers, false)).toThrow();
  });

  it('rejects blank mode below six players', () => {
    expect(() => getUndercoverRoleCounts(5, true)).toThrow();
  });

  const scenarios: readonly {
    readonly roles: readonly UndercoverRole[];
    readonly winner: UndercoverRole | null;
  }[] = [
    { roles: ['civilian', 'civilian', 'undercover'], winner: null },
    { roles: ['civilian', 'undercover'], winner: 'undercover' },
    { roles: ['civilian', 'civilian'], winner: 'civilian' },
    { roles: ['civilian', 'civilian', 'undercover', 'undercover'], winner: 'undercover' },
    { roles: ['civilian', 'undercover', 'blank'], winner: null },
    { roles: ['undercover', 'undercover', 'blank'], winner: null },
    { roles: ['civilian', 'civilian', 'blank'], winner: null },
    { roles: ['civilian', 'blank'], winner: 'blank' },
    { roles: ['undercover', 'blank'], winner: 'blank' },
  ];

  it.each(scenarios)('resolves survivors $roles as $winner', ({ roles, winner }) => {
    expect(getUndercoverWinner(roles)).toBe(winner);
  });
});

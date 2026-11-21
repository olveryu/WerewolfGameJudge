import { describe, expect, it } from 'vitest';

import { materializeLegacyRoster } from '../legacyRoster';

const humans = { 0: { seat: 0, userId: 'host' }, 2: { seat: 2, userId: 'u2' } };

describe('materializeLegacyRoster', () => {
  it('keeps only the humans when fill is disabled', () => {
    expect(
      materializeLegacyRoster({
        humans,
        fillEmptySeatsWithBots: false,
        excludedBotSeats: [],
        numberOfPlayers: 4,
      }),
    ).toEqual(humans);
  });

  it('fills every unoccupied, non-excluded seat with a bot when fill is enabled', () => {
    expect(
      materializeLegacyRoster({
        humans,
        fillEmptySeatsWithBots: true,
        excludedBotSeats: [3],
        numberOfPlayers: 5,
      }),
    ).toEqual({
      0: { seat: 0, userId: 'host' },
      1: { seat: 1, kind: 'bot' },
      2: { seat: 2, userId: 'u2' },
      4: { seat: 4, kind: 'bot' },
    });
  });

  it('never overwrites a human seat, even when it is also excluded', () => {
    const roster = materializeLegacyRoster({
      humans,
      fillEmptySeatsWithBots: true,
      excludedBotSeats: [0, 2],
      numberOfPlayers: 3,
    });
    expect(roster[0]).toEqual({ seat: 0, userId: 'host' });
    expect(roster[2]).toEqual({ seat: 2, userId: 'u2' });
    expect(roster[1]).toEqual({ seat: 1, kind: 'bot' });
  });
});

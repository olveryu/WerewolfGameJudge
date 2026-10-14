import { describe, expect, it } from 'vitest';

import {
  buildSeatIdentityView,
  getSeatDisplayName,
  type SeatIdentityOccupant,
} from '../seatIdentity';
import type { RosterMap } from '../seating';

const botName = (seat: number): string => `bot-name-${seat}`;

// Seat 0: human with a profile name. Seat 1: bot. Seat 2: empty.
const ROSTER = {
  0: { seat: 0, userId: 'host', profile: { displayName: '房主' } },
  1: { seat: 1, kind: 'bot' },
} satisfies RosterMap<SeatIdentityOccupant>;

describe('getSeatDisplayName', () => {
  it('returns the human occupant profile display name', () => {
    expect(getSeatDisplayName(ROSTER, 0, botName)).toBe('房主');
  });

  it('falls back to the game bot name for a bot seat', () => {
    expect(getSeatDisplayName(ROSTER, 1, botName)).toBe('bot-name-1');
  });

  it('falls back to the game bot name for an empty seat', () => {
    expect(getSeatDisplayName(ROSTER, 2, botName)).toBe('bot-name-2');
  });
});

describe('buildSeatIdentityView', () => {
  it('projects a human seat with its profile name and isBot false', () => {
    expect(buildSeatIdentityView(ROSTER, 0, botName)).toEqual({
      seat: 0,
      displayName: '房主',
      isBot: false,
    });
  });

  it('projects a bot seat with the game bot name and isBot true', () => {
    expect(buildSeatIdentityView(ROSTER, 1, botName)).toEqual({
      seat: 1,
      displayName: 'bot-name-1',
      isBot: true,
    });
  });
});

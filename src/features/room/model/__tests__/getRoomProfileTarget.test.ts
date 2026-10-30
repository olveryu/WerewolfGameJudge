/** Contract tests for the shared roster-to-profile-target derivation. */

import { getRoomProfileTarget } from '../getRoomProfileTarget';

const roster = {
  0: { userId: 'user-1', profile: { displayName: '甲' } },
  1: { kind: 'bot' as const },
};

describe('getRoomProfileTarget', () => {
  it('projects a human occupant with its own identity and display name', () => {
    expect(getRoomProfileTarget(roster, 0)).toEqual({
      seat: 0,
      occupant: { kind: 'human', userId: 'user-1' },
      rosterName: '甲',
    });
  });

  it('identifies a bot occupant by seat with the shared bot name', () => {
    expect(getRoomProfileTarget(roster, 1)).toEqual({
      seat: 1,
      occupant: { kind: 'bot', seat: 1 },
      rosterName: '机器人2号',
    });
  });

  it('returns null for an empty seat', () => {
    expect(getRoomProfileTarget(roster, 2)).toBeNull();
  });
});

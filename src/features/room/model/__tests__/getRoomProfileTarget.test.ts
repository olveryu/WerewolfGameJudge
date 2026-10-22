/** Contract tests for the shared roster-to-profile-target derivation and its per-game resolver factory. */

import {
  createRoomProfileTargetResolver,
  getRoomProfileTarget,
  type RoomProfileTargetState,
} from '../getRoomProfileTarget';

const roster = {
  0: { userId: 'user-1', profile: { displayName: '甲' } },
  1: { kind: 'bot' as const },
};

const botUserId = (roomCode: string, seat: number): string => `game-bot:${roomCode}:${seat}`;
const botDisplayName = (seat: number): string => `机器人${seat + 1}`;

describe('getRoomProfileTarget', () => {
  it('projects a human occupant with its own identity and display name', () => {
    expect(
      getRoomProfileTarget(roster, 0, (seat) => botUserId('ROOM42', seat), botDisplayName),
    ).toEqual({
      seat: 0,
      userId: 'user-1',
      occupantKind: 'human',
      rosterName: '甲',
    });
  });

  it('synthesizes a bot occupant identity from the seat', () => {
    expect(
      getRoomProfileTarget(roster, 1, (seat) => botUserId('ROOM42', seat), botDisplayName),
    ).toEqual({
      seat: 1,
      userId: 'game-bot:ROOM42:1',
      occupantKind: 'bot',
      rosterName: '机器人2',
    });
  });

  it('returns null for an empty seat', () => {
    expect(
      getRoomProfileTarget(roster, 2, (seat) => botUserId('ROOM42', seat), botDisplayName),
    ).toBeNull();
  });
});

describe('createRoomProfileTargetResolver', () => {
  const state: RoomProfileTargetState = { roster, roomCode: 'ROOM42' };
  const resolve = createRoomProfileTargetResolver(botUserId, botDisplayName);

  it('matches the direct derivation for human, bot and empty seats', () => {
    for (const seat of [0, 1, 2]) {
      expect(resolve(state, seat)).toEqual(
        getRoomProfileTarget(
          state.roster,
          seat,
          (botSeat) => botUserId(state.roomCode, botSeat),
          botDisplayName,
        ),
      );
    }
  });

  it('binds the room code of the state it is given, not a captured one', () => {
    expect(resolve({ roster, roomCode: 'OTHER7' }, 1)?.userId).toBe('game-bot:OTHER7:1');
  });
});

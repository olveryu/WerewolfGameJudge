import { toRoomSeatPlayer } from '../toRoomSeatPlayer';

describe('toRoomSeatPlayer', () => {
  it('projects a full human profile, renaming revealEffect to seatPetId', () => {
    expect(
      toRoomSeatPlayer({
        kind: 'human',
        userId: 'u1',
        displayName: '阿珍',
        avatarUrl: 'https://example.test/a.png',
        avatarFrame: 'gold',
        seatFlair: 'sparkle',
        seatAnimation: 'bounce',
        nameStyle: 'rainbow',
        revealEffect: 'tarot',
        level: 12,
      }),
    ).toEqual({
      kind: 'human',
      userId: 'u1',
      displayName: '阿珍',
      avatarUrl: 'https://example.test/a.png',
      avatarFrame: 'gold',
      seatFlair: 'sparkle',
      seatAnimation: 'bounce',
      nameStyle: 'rainbow',
      seatPetId: 'tarot',
      level: 12,
      isAnonymous: false,
    });
  });

  it('marks a profile without an avatar as anonymous', () => {
    const player = toRoomSeatPlayer({ kind: 'human', userId: 'u2', displayName: '匿名玩家' });
    expect(player.isAnonymous).toBe(true);
    expect(player.seatPetId).toBeUndefined();
    expect(player.level).toBeUndefined();
  });

  it('projects a bot with no profile facts as anonymous', () => {
    expect(toRoomSeatPlayer({ kind: 'bot', userId: 'bot-3', displayName: '机器人3号' })).toEqual({
      kind: 'bot',
      userId: 'bot-3',
      displayName: '机器人3号',
      avatarUrl: undefined,
      avatarFrame: undefined,
      seatFlair: undefined,
      seatAnimation: undefined,
      nameStyle: undefined,
      seatPetId: undefined,
      level: undefined,
      isAnonymous: true,
    });
  });
});

import { parseWerewolfPublicStats } from '../publicStats';

describe('parseWerewolfPublicStats', () => {
  it('parses a complete camp distribution', () => {
    expect(
      parseWerewolfPublicStats({
        gameType: 'werewolf',
        campStats: {
          total: 6,
          counts: { wolf: 2, god: 2, villager: 1, third: 1 },
        },
      }),
    ).toEqual({
      gameType: 'werewolf',
      campStats: {
        total: 6,
        counts: { wolf: 2, god: 2, villager: 1, third: 1 },
      },
    });
  });

  it.each([
    ['wrong game type', { gameType: 'fibking', campStats: {} }],
    [
      'missing camp bucket',
      {
        gameType: 'werewolf',
        campStats: { total: 0, counts: { wolf: 0, god: 0, villager: 0 } },
      },
    ],
    [
      'negative count',
      {
        gameType: 'werewolf',
        campStats: {
          total: 0,
          counts: { wolf: -1, god: 0, villager: 0, third: 1 },
        },
      },
    ],
    [
      'inconsistent total',
      {
        gameType: 'werewolf',
        campStats: {
          total: 7,
          counts: { wolf: 2, god: 2, villager: 1, third: 1 },
        },
      },
    ],
  ])('rejects %s', (_caseName, value) => {
    expect(() => parseWerewolfPublicStats(value)).toThrow();
  });
});

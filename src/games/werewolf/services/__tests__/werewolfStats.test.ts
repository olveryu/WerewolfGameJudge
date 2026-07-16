import { cfGet } from '@/services/cloudflare/cfFetch';

import { fetchWerewolfPublicStats, werewolfPublicStatsOptions } from '../werewolfStats';

jest.mock('@/services/cloudflare/cfFetch', () => ({ cfGet: jest.fn() }));

const mockCfGet = jest.mocked(cfGet);

function respondWithJson(value: unknown): void {
  mockCfGet.mockImplementationOnce(async (_path, decode) => decode(value));
}

describe('werewolfStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the game-namespaced user stats endpoint and parses its identity', async () => {
    respondWithJson({
      gameType: 'werewolf',
      campStats: {
        total: 3,
        counts: { wolf: 1, god: 1, villager: 1, third: 0 },
      },
    });

    await expect(fetchWerewolfPublicStats('user / 1')).resolves.toEqual({
      gameType: 'werewolf',
      campStats: {
        total: 3,
        counts: { wolf: 1, god: 1, villager: 1, third: 0 },
      },
    });
    expect(mockCfGet).toHaveBeenCalledWith(
      '/api/games/werewolf/users/user%20%2F%201/stats',
      expect.any(Function),
    );
  });

  it('rejects a malformed server payload', async () => {
    respondWithJson({
      gameType: 'werewolf',
      campStats: {
        total: 2,
        counts: { wolf: 1, god: 0, villager: 0, third: 0 },
      },
    });

    await expect(fetchWerewolfPublicStats('user-1')).rejects.toThrow(
      'campStats.total must equal the camp count sum',
    );
  });

  it('uses a game-owned cache key', () => {
    expect(werewolfPublicStatsOptions('user-1').queryKey).toEqual([
      'games',
      'werewolf',
      'users',
      'user-1',
      'stats',
    ]);
  });
});

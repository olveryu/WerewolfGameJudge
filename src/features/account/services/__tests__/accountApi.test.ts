import { cfGet } from '@/services/cloudflare/cfFetch';

import { fetchUserProfile, fetchUserStats, fetchUserUnlocks } from '../accountApi';

jest.mock('@/services/cloudflare/cfFetch', () => ({ cfGet: jest.fn() }));

const mockCfGet = jest.mocked(cfGet);

function respondWithJson(value: unknown): void {
  mockCfGet.mockImplementationOnce(async (_path, decode) => decode(value));
}

describe('accountApi response contracts', () => {
  beforeEach(() => mockCfGet.mockReset());

  it('decodes stats, public profile, and unlock responses', async () => {
    respondWithJson({ xp: 10, level: 2, gamesPlayed: 3, unlockedItems: ['avatar-wolf'] });
    respondWithJson({
      displayName: 'Alice',
      avatarUrl: 'builtin://wolf',
      level: 2,
      title: '新手',
      xp: 10,
      gamesPlayed: 3,
      unlockedItemCount: 1,
    });
    respondWithJson({ unlockedItems: ['avatar-wolf'] });

    await expect(fetchUserStats()).resolves.toEqual({
      xp: 10,
      level: 2,
      gamesPlayed: 3,
      unlockedItems: ['avatar-wolf'],
    });
    await expect(fetchUserProfile('user / 1')).resolves.toMatchObject({
      displayName: 'Alice',
      avatarUrl: 'builtin://wolf',
    });
    await expect(fetchUserUnlocks('user-1')).resolves.toEqual({
      unlockedItems: ['avatar-wolf'],
    });
    expect(mockCfGet.mock.calls[1]?.[0]).toBe('/api/user/user%20%2F%201/profile');
  });

  it('rejects negative counters and undeclared response fields', async () => {
    respondWithJson({
      xp: -1,
      level: 0,
      gamesPlayed: 0,
      unlockedItems: [],
      compatibility: true,
    });

    await expect(fetchUserStats()).rejects.toThrow();
  });
});

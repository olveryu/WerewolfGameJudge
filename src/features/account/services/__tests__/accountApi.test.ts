import { requestSpecAt, respondWithJson as queueJson, spyOnApiJson } from '@/test-utils/apiClient';

import { fetchUserProfile, fetchUserStats, fetchUserUnlocks } from '../accountApi';

const jsonSpy = spyOnApiJson();

function respondWithJson(value: unknown): void {
  queueJson(jsonSpy, value);
}

describe('accountApi response contracts', () => {
  beforeEach(() => jsonSpy.mockReset());

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
    expect(requestSpecAt(jsonSpy, 1)).toMatchObject({
      method: 'GET',
      path: '/api/user/user%20%2F%201/profile',
      auth: 'required',
      idempotent: true,
    });
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

  it('accepts random reveal effects and rejects unknown effect IDs', async () => {
    const profile = {
      displayName: 'Alice',
      level: 2,
      title: '新手',
      xp: 10,
      gamesPlayed: 3,
      unlockedItemCount: 1,
    };
    respondWithJson({ ...profile, revealEffect: 'random' });
    respondWithJson({ ...profile, revealEffect: 'unknown-effect' });

    await expect(fetchUserProfile('user-1')).resolves.toMatchObject({ revealEffect: 'random' });
    await expect(fetchUserProfile('user-1')).rejects.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { parseSpotmatchPublicStats, spotmatchCompletionPayloadSchema } from '../publicStats';

describe('Spotmatch statistics contracts', () => {
  it('rejects missing, invalid and unknown public counts instead of defaulting them', () => {
    expect(
      parseSpotmatchPublicStats({
        gameType: 'spotmatch',
        gamesPlayed: 0,
        wins: 0,
        correctCards: 0,
        mistakes: 0,
      }),
    ).toEqual({
      gameType: 'spotmatch',
      gamesPlayed: 0,
      wins: 0,
      correctCards: 0,
      mistakes: 0,
    });
    for (const gamesPlayed of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      expect(() => parseSpotmatchPublicStats({ gameType: 'spotmatch', gamesPlayed })).toThrow();
    }
    expect(() =>
      parseSpotmatchPublicStats({
        gameType: 'spotmatch',
        gamesPlayed: 1,
        wins: 1,
      }),
    ).toThrow();
  });

  it('requires exact v2 facts matching the completion roster in seat order', () => {
    const payload = {
      roundId: 'round',
      completedAt: 1,
      participantUserIds: ['u1', 'u2'],
      completionVersion: 2,
      stats: [
        { userId: 'u1', gamesPlayed: 1, wins: 1, correctCards: 8, mistakes: 1 },
        { userId: 'u2', gamesPlayed: 1, wins: 0, correctCards: 2, mistakes: 0 },
      ],
    };
    expect(spotmatchCompletionPayloadSchema.parse(payload)).toEqual(payload);
    for (const stats of [
      [payload.stats[0]],
      [payload.stats[1], payload.stats[0]],
      [payload.stats[0], payload.stats[0]],
      [{ ...payload.stats[0], wins: 2 }, payload.stats[1]],
      [{ userId: 'u1', gamesPlayed: 2 }, payload.stats[1]],
    ]) {
      expect(spotmatchCompletionPayloadSchema.safeParse({ ...payload, stats }).success).toBe(false);
    }
  });
});

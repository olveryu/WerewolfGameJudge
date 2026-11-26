import { describe, expect, it } from 'vitest';

import { decryptoCompletionPayloadSchema, parseDecryptoPublicStats } from '../publicStats';

describe('Decrypto statistics contracts', () => {
  it('rejects missing, invalid and unknown public counts instead of defaulting them', () => {
    expect(parseDecryptoPublicStats({ gameType: 'decrypto', gamesPlayed: 0, wins: 0 })).toEqual({
      gameType: 'decrypto',
      gamesPlayed: 0,
      wins: 0,
    });
    for (const gamesPlayed of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      expect(() =>
        parseDecryptoPublicStats({ gameType: 'decrypto', gamesPlayed, wins: 0 }),
      ).toThrow();
    }
    for (const wins of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      expect(() =>
        parseDecryptoPublicStats({ gameType: 'decrypto', gamesPlayed: 0, wins }),
      ).toThrow();
    }
    expect(() => parseDecryptoPublicStats({ gameType: 'decrypto', gamesPlayed: 0 })).toThrow();
    expect(() =>
      parseDecryptoPublicStats({
        gameType: 'decrypto',
        gamesPlayed: 1,
        wins: 1,
        extra: 1,
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
        { userId: 'u1', gamesPlayed: 1, wins: 1 },
        { userId: 'u2', gamesPlayed: 1, wins: 0 },
      ],
    };
    expect(decryptoCompletionPayloadSchema.parse(payload)).toEqual(payload);
    for (const stats of [
      [payload.stats[0]],
      [payload.stats[1], payload.stats[0]],
      [payload.stats[0], payload.stats[0]],
      [{ ...payload.stats[0], extra: true }, payload.stats[1]],
      [{ userId: 'u1', gamesPlayed: 1 }, payload.stats[1]],
      [{ userId: 'u1', gamesPlayed: 2 }, payload.stats[1]],
    ]) {
      expect(decryptoCompletionPayloadSchema.safeParse({ ...payload, stats }).success).toBe(false);
    }
  });
});

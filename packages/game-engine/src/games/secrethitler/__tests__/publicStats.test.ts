import { describe, expect, it } from 'vitest';

import { parseSecrethitlerPublicStats, secrethitlerCompletionPayloadSchema } from '../publicStats';

describe('Secrethitler statistics contracts', () => {
  it('requires win counters and rejects counters exceeding completed games', () => {
    expect(
      parseSecrethitlerPublicStats({
        gameType: 'secrethitler',
        gamesPlayed: 2,
        liberalWins: 1,
        fascistWins: 1,
      }),
    ).toEqual({
      gameType: 'secrethitler',
      gamesPlayed: 2,
      liberalWins: 1,
      fascistWins: 1,
    });
    for (const gamesPlayed of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      expect(() =>
        parseSecrethitlerPublicStats({
          gameType: 'secrethitler',
          gamesPlayed,
          liberalWins: 0,
          fascistWins: 0,
        }),
      ).toThrow();
    }
    expect(() =>
      parseSecrethitlerPublicStats({
        gameType: 'secrethitler',
        gamesPlayed: 1,
        liberalWins: 2,
        fascistWins: 0,
      }),
    ).toThrow();
    expect(() =>
      parseSecrethitlerPublicStats({
        gameType: 'secrethitler',
        gamesPlayed: 1,
        liberalWins: 0,
        fascistWins: 2,
      }),
    ).toThrow();
    expect(() =>
      parseSecrethitlerPublicStats({
        gameType: 'secrethitler',
        gamesPlayed: 1,
        liberalWins: 1,
        fascistWins: 1,
      }),
    ).toThrow();
    expect(() =>
      parseSecrethitlerPublicStats({
        gameType: 'secrethitler',
        gamesPlayed: 1,
        wins: 1,
        liberalWins: 0,
        fascistWins: 0,
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
        { userId: 'u1', gamesPlayed: 1, liberalWins: 1, fascistWins: 0 },
        { userId: 'u2', gamesPlayed: 1, liberalWins: 0, fascistWins: 1 },
      ],
    };
    expect(secrethitlerCompletionPayloadSchema.parse(payload)).toEqual(payload);
    for (const stats of [
      [payload.stats[0]],
      [payload.stats[1], payload.stats[0]],
      [payload.stats[0], payload.stats[0]],
      [{ ...payload.stats[0], wins: 1 }, payload.stats[1]],
      [{ userId: 'u1', gamesPlayed: 2, liberalWins: 0, fascistWins: 0 }, payload.stats[1]],
      [{ userId: 'u1', gamesPlayed: 1, liberalWins: 1, fascistWins: 1 }, payload.stats[1]],
    ]) {
      expect(secrethitlerCompletionPayloadSchema.safeParse({ ...payload, stats }).success).toBe(
        false,
      );
    }
  });
});

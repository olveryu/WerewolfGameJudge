import {
  parseSecrethitlerPublicStats,
  secrethitlerEngine,
} from '@game-judge/game-engine/games/secrethitler/public';
import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { settleGameRewards } from '../../../features/account/settleGameRewards';
import { handleSecrethitlerEffect, secrethitlerEffectSchema } from '../effects';
import { getSecrethitlerPublicUserStats, secrethitlerStatsSettlement } from '../publicUserStats';

beforeEach(async () => {
  await env.DB.exec(
    'DELETE FROM product_game_reward_results; DELETE FROM product_game_reward_claims; DELETE FROM user_stats; DELETE FROM users;',
  );
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES ('stats-user', 'Player', 0, datetime('now'), datetime('now')),
       ('stats-guest', 'Guest', 1, datetime('now'), datetime('now'))`,
  ).run();
});

describe('Secrethitler cumulative statistics', () => {
  it('delivers legacy and current owner effects without synthesizing legacy stats', async () => {
    const context = {
      bindings: env,
      effectId: 'stats-effect',
      state: secrethitlerEngine.createInitialState(
        { numberOfPlayers: 5 },
        { roomCode: '4321', hostUserId: 'stats-user', nowMs: 1, commandId: 'create' },
      ),
      roomIdentity: { roomId: 'stats-room', roomCode: '4321', creationId: 'stats-creation' },
      createdRevision: 1,
      deliveryAttemptCount: 1,
      dispatchInternal: () => {
        throw new Error('unexpected dispatch');
      },
      publishUserEvent: () => Promise.resolve(),
    };
    const payload = {
      roundId: 'legacy',
      completedAt: 1,
      participantUserIds: ['stats-user', 'stats-guest'],
    };
    await handleSecrethitlerEffect(
      secrethitlerEffectSchema.parse({
        type: 'secrethitler.game.completed',
        payload,
      }),
      context,
    );
    expect((await getSecrethitlerPublicUserStats('stats-user', env)).gamesPlayed).toBe(0);
    const current = secrethitlerEffectSchema.parse({
      type: 'secrethitler.game.completed',
      payload: {
        ...payload,
        roundId: 'current',
        completionVersion: 2,
        stats: payload.participantUserIds.map((userId, index) => ({
          userId,
          gamesPlayed: 1,
          liberalWins: index === 0 ? 1 : 0,
          fascistWins: index === 0 ? 0 : 1,
        })),
      },
    });
    await handleSecrethitlerEffect(current, context);
    await handleSecrethitlerEffect(current, context);
    expect((await getSecrethitlerPublicUserStats('stats-user', env)).gamesPlayed).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT games_played FROM user_stats WHERE user_id = 'stats-user'",
      ).first(),
    ).toEqual({ games_played: 2 });
  });

  it('serves the strict game DTO through the existing authenticated stats route', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'stats-user', ver: 0, iat: now, exp: now + 3600 })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    const response = await SELF.fetch(
      'https://test.local/api/games/secrethitler/users/stats-user/stats',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(response.status).toBe(200);
    expect(parseSecrethitlerPublicStats(await response.json())).toEqual({
      gameType: 'secrethitler',
      gamesPlayed: 0,
      liberalWins: 0,
      fascistWins: 0,
    });
  });

  it('atomically counts only registered recipients, replays once, and deletes with the account', async () => {
    const counted = createRowCountingDb(env.DB);
    const input = {
      settlementId: 'stats-round',
      gameType: 'secrethitler' as const,
      kind: 'completion' as const,
      completedAt: 1,
      participantUserIds: ['stats-user', 'stats-guest'],
    };
    const stats = secrethitlerStatsSettlement(
      input.participantUserIds.map((userId) => ({
        userId,
        gamesPlayed: 1 as const,
        liberalWins: 0 as const,
        fascistWins: 1 as const,
      })),
    );
    await env.DB.prepare(
      `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
       VALUES ('baseline-user', 'Baseline', 0, datetime('now'), datetime('now'))`,
    ).run();
    const baseline = createRowCountingDb(env.DB);
    await settleGameRewards(baseline.db, {
      ...input,
      settlementId: 'baseline-round',
      participantUserIds: ['baseline-user', 'stats-guest'],
    });
    expect(baseline.counts.rowsWritten).toBeLessThanOrEqual(11);
    const first = await settleGameRewards(counted.db, input, stats);
    const initialWrites = counted.counts.rowsWritten;
    expect(initialWrites).toBeGreaterThan(0);
    // One registered counter adds its row and primary-key index to the same reward baseline.
    expect(initialWrites).toBeLessThanOrEqual(baseline.counts.rowsWritten + 2);
    expect(await settleGameRewards(env.DB, input, stats)).toEqual(first);
    expect(await getSecrethitlerPublicUserStats('stats-user', env)).toEqual({
      gameType: 'secrethitler',
      gamesPlayed: 1,
      liberalWins: 0,
      fascistWins: 1,
    });
    expect(await getSecrethitlerPublicUserStats('stats-guest', env)).toEqual({
      gameType: 'secrethitler',
      gamesPlayed: 0,
      liberalWins: 0,
      fascistWins: 0,
    });
    await env.DB.prepare("UPDATE users SET is_anonymous = 0 WHERE id = 'stats-guest'").run();
    await settleGameRewards(env.DB, input, stats);
    expect((await getSecrethitlerPublicUserStats('stats-guest', env)).gamesPlayed).toBe(0);
    counted.reset();
    expect(
      (await getSecrethitlerPublicUserStats('stats-user', { ...env, DB: counted.db })).gamesPlayed,
    ).toBe(1);
    expect(counted.counts.rowsRead).toBeLessThanOrEqual(2);
    await expect(
      env.DB.prepare(
        "UPDATE secrethitler_user_stats SET games_played = -1 WHERE user_id = 'stats-user'",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "UPDATE secrethitler_user_stats SET games_played = 0.5 WHERE user_id = 'stats-user'",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "UPDATE secrethitler_user_stats SET liberal_wins = -1 WHERE user_id = 'stats-user'",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "UPDATE secrethitler_user_stats SET liberal_wins = 2 WHERE user_id = 'stats-user'",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "UPDATE secrethitler_user_stats SET liberal_wins = 1, fascist_wins = 1 WHERE user_id = 'stats-user'",
      ).run(),
    ).rejects.toThrow();
    await env.DB.prepare("DELETE FROM users WHERE id = 'stats-user'").run();
    expect(
      await env.DB.prepare(
        "SELECT * FROM secrethitler_user_stats WHERE user_id = 'stats-user'",
      ).first(),
    ).toBeNull();
  });

  it('rolls back reward and stats together when the stats write fails', async () => {
    const input = {
      settlementId: 'failed-round',
      gameType: 'secrethitler' as const,
      kind: 'completion' as const,
      completedAt: 1,
      participantUserIds: ['stats-user'],
    };
    const stats = secrethitlerStatsSettlement([
      { userId: 'stats-user', gamesPlayed: 1, liberalWins: 0, fascistWins: 1 },
    ]);
    await expect(
      settleGameRewards(env.DB, input, {
        ...stats,
        createStatement: (db) =>
          db.prepare(
            "INSERT INTO secrethitler_user_stats (user_id, games_played, liberal_wins, fascist_wins) VALUES ('stats-user', -1, 0, 0)",
          ),
      }),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = 'stats-user'").first(),
    ).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT * FROM product_game_reward_claims WHERE id = 'failed-round'",
      ).first(),
    ).toBeNull();
    expect((await getSecrethitlerPublicUserStats('stats-user', env)).gamesPlayed).toBe(0);
    await settleGameRewards(env.DB, input, stats);
    expect((await getSecrethitlerPublicUserStats('stats-user', env)).gamesPlayed).toBe(1);
  });

  it.each([8, 256])('keeps primary-key reads bounded with %i unrelated accounts', async (size) => {
    await env.DB.batch(
      Array.from({ length: size }, (_, index) =>
        env.DB.prepare(
          `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
         VALUES (?1, 'Other', 0, datetime('now'), datetime('now'))`,
        ).bind(`other-${index}`),
      ),
    );
    await env.DB.batch(
      Array.from({ length: size }, (_, index) =>
        env.DB.prepare(
          'INSERT INTO secrethitler_user_stats (user_id, games_played, liberal_wins, fascist_wins) VALUES (?1, 1000, 0, 0)',
        ).bind(`other-${index}`),
      ),
    );
    const measured = createRowCountingDb(env.DB);
    expect(
      (await getSecrethitlerPublicUserStats('stats-user', { ...env, DB: measured.db })).gamesPlayed,
    ).toBe(0);
    expect(measured.counts.rowsRead).toBeLessThanOrEqual(2);
  });

  it('keeps legacy effects reward-only but rejects malformed partial v2 payloads', () => {
    const legacy = { roundId: 'round', completedAt: 1, participantUserIds: ['stats-user'] };
    const effect = { type: 'secrethitler.game.completed', payload: legacy };
    expect(secrethitlerEffectSchema.safeParse(effect).success).toBe(true);
    expect(
      secrethitlerEffectSchema.safeParse({
        ...effect,
        payload: { ...legacy, completionVersion: 2 },
      }).success,
    ).toBe(false);
    expect(
      secrethitlerEffectSchema.safeParse({
        ...effect,
        payload: { ...legacy, completionVersion: 2, stats: [] },
      }).success,
    ).toBe(false);
    expect(
      secrethitlerEffectSchema.safeParse({
        ...effect,
        payload: {
          ...legacy,
          completionVersion: 2,
          stats: [{ userId: 'stats-user', gamesPlayed: 1, liberalWins: 0, fascistWins: 1 }],
        },
      }).success,
    ).toBe(true);
  });
});

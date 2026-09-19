/** Real D1 reward transactions cover replay, daily thresholds, and concurrent games. */
import { env } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';

import { type GameRewardInput, publishGameRewards, settleGameRewards } from '../settleGameRewards';

const completedAt = Date.UTC(2026, 8, 18, 12);

it('retries account delivery using the committed reward after the room is gone', async () => {
  const publishUserEvent = vi
    .fn()
    .mockRejectedValueOnce(new Error('inbox unavailable'))
    .mockResolvedValue(undefined);
  const context = {
    bindings: env,
    roomIdentity: { roomId: 'finished-room', roomCode: '1234', creationId: 'creation' },
    createdRevision: 8,
    publishUserEvent,
  };
  const reward = {
    kind: 'completion' as const,
    gameType: 'pictionary' as const,
    roundId: 'round',
    completedAt,
    participantUserIds: ['reward-user'],
  };
  await expect(publishGameRewards(reward, context)).rejects.toThrow('inbox unavailable');
  await publishGameRewards(reward, context);
  expect(publishUserEvent.mock.calls[1]).toEqual(publishUserEvent.mock.calls[0]);
  expect(
    await env.DB.prepare(
      "SELECT xp, normal_draws, golden_draws FROM user_stats WHERE user_id = 'reward-user'",
    ).first(),
  ).toEqual({ xp: 15, normal_draws: 3, golden_draws: 2 });
});
function completion(
  settlementId: string,
  gameType: 'fibking' | 'pictionary' = 'fibking',
): GameRewardInput {
  return {
    settlementId,
    gameType,
    kind: 'completion',
    completedAt,
    participantUserIds: ['reward-user', 'reward-guest'],
  };
}

beforeEach(async () => {
  await env.DB.exec(
    'DELETE FROM product_game_reward_results; DELETE FROM product_game_reward_claims; DELETE FROM user_stats; DELETE FROM users;',
  );
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
    VALUES ('reward-user', 'Player', 0, datetime('now'), datetime('now')),
    ('reward-guest', 'Guest', 1, datetime('now'), datetime('now'))`,
  ).run();
});

it('awards only registered humans and replays without changing balances', async () => {
  const input = completion('first');
  const results = await settleGameRewards(env.DB, input);
  expect(results).toEqual([
    {
      userId: 'reward-user',
      xpEarned: 5,
      newXp: 5,
      previousLevel: 0,
      newLevel: 0,
      normalDrawsEarned: 1,
      goldenDrawsEarned: 0,
    },
  ]);
  expect(await settleGameRewards(env.DB, input)).toEqual(results);
  await env.DB.prepare("UPDATE users SET is_anonymous = 0 WHERE id = 'reward-guest'").run();
  expect(await settleGameRewards(env.DB, input)).toEqual(results);
  expect(
    await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = 'reward-guest'").first(),
  ).toBeNull();
  expect(
    await env.DB.prepare(
      "SELECT xp, normal_draws, games_played FROM user_stats WHERE user_id = 'reward-user'",
    ).first(),
  ).toEqual({ xp: 5, normal_draws: 1, games_played: 1 });
  await expect(
    settleGameRewards(env.DB, { ...input, completedAt: completedAt + 1 }),
  ).rejects.toThrow();
});

it('awards daily bonuses once across concurrent rounds, with a fresh day boundary', async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      settleGameRewards(env.DB, completion(`round-${index}`)),
    ),
  );
  expect(results.flat().reduce((total, result) => total + result.goldenDrawsEarned, 0)).toBe(2);
  const [gallery] = await settleGameRewards(env.DB, completion('gallery', 'pictionary'));
  expect(gallery).toMatchObject({ xpEarned: 15, goldenDrawsEarned: 2 });
  const [next] = await settleGameRewards(env.DB, {
    ...completion('gallery-next', 'pictionary'),
    completedAt: completedAt + 86_400_000,
  });
  expect(next).toMatchObject({ newXp: 60, newLevel: 1 });
  expect(next.goldenDrawsEarned).toBeGreaterThanOrEqual(3);
});

it('adds MVP tickets without XP or another completed game and preserves concurrent rewards', async () => {
  await Promise.all([
    settleGameRewards(env.DB, completion('gallery', 'pictionary')),
    settleGameRewards(env.DB, completion('fib')),
    settleGameRewards(env.DB, {
      settlementId: 'mvp',
      kind: 'mvp',
      gameType: 'werewolf',
      completedAt,
      participantUserIds: ['reward-user'],
      humanPlayerCount: 12,
    }),
  ]);
  expect(
    await env.DB.prepare(
      "SELECT xp, games_played, normal_draws, golden_draws FROM user_stats WHERE user_id = 'reward-user'",
    ).first(),
  ).toEqual({ xp: 20, games_played: 2, normal_draws: 4, golden_draws: 26 });
});

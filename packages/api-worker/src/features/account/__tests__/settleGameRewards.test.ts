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
  gameType: 'fibking' | 'pictionary' | 'undercover' | 'storyrelay' = 'fibking',
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

it.each(['fibking', 'undercover'] as const)(
  'awards only registered %s humans and replays without changing balances',
  async (gameType) => {
    const input = completion('first', gameType);
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
  },
);

it.each(['fibking', 'undercover'] as const)(
  'awards %s daily bonuses once across concurrent rounds, with a fresh day boundary',
  async (gameType) => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        settleGameRewards(env.DB, completion(`round-${index}`, gameType)),
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
  },
);

it('counts Undercover daily completions independently from FibKing', async () => {
  for (let index = 0; index < 4; index += 1) {
    await settleGameRewards(env.DB, completion(`fibking-${index}`));
  }
  for (let index = 0; index < 5; index += 1) {
    const [result] = await settleGameRewards(
      env.DB,
      completion(`undercover-${index}`, 'undercover'),
    );
    expect(result.goldenDrawsEarned).toBe(index === 4 ? 2 : 0);
  }
  expect(
    await env.DB.prepare(
      "SELECT xp, normal_draws, golden_draws FROM user_stats WHERE user_id = 'reward-user'",
    ).first(),
  ).toEqual({ xp: 45, normal_draws: 9, golden_draws: 2 });
});

it('settles Story Relay exactly once, excludes anonymous users and retains prior reward receipts', async () => {
  const previous = completion('previous-gallery', 'pictionary');
  const previousResults = await settleGameRewards(env.DB, previous);
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0059_storyrelay.sql');
  if (migration === undefined) throw new Error('Missing Story Relay migration');
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
  expect(await settleGameRewards(env.DB, previous)).toEqual(previousResults);
  const input = completion('story-round', 'storyrelay');
  const [first, replay] = await Promise.all([
    settleGameRewards(env.DB, input),
    settleGameRewards(env.DB, input),
  ]);
  expect(first).toEqual(replay);
  expect(first).toEqual([
    expect.objectContaining({
      userId: 'reward-user',
      xpEarned: 15,
      normalDrawsEarned: 3,
      goldenDrawsEarned: 2,
    }),
  ]);
  expect(
    await env.DB.prepare(
      "SELECT xp, games_played FROM user_stats WHERE user_id = 'reward-user'",
    ).first(),
  ).toEqual({ xp: 30, games_played: 2 });
  expect(
    await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = 'reward-guest'").first(),
  ).toBeNull();
  expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({ results: [] });
});

it('preserves historical rewards and replay receipts when expanding the game constraint', async () => {
  const input = completion('before-migration', 'pictionary');
  const results = await settleGameRewards(env.DB, input);
  await settleGameRewards(env.DB, completion('before-migration-fibking'));
  await settleGameRewards(env.DB, {
    settlementId: 'before-migration-mvp',
    kind: 'mvp',
    gameType: 'werewolf',
    completedAt,
    participantUserIds: ['reward-user'],
    humanPlayerCount: 8,
  });
  const before = await env.DB.prepare(
    'SELECT * FROM product_game_reward_results ORDER BY settlement_id, user_id',
  ).all();
  const stats = await env.DB.prepare(
    "SELECT * FROM user_stats WHERE user_id = 'reward-user'",
  ).first();
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0058_undercover_rewards.sql');
  if (migration === undefined) throw new Error('Missing Undercover rewards migration');
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
  const after = await env.DB.prepare(
    'SELECT * FROM product_game_reward_results ORDER BY settlement_id, user_id',
  ).all();
  expect(after.results).toEqual(before.results);
  expect(await settleGameRewards(env.DB, input)).toEqual(results);
  expect(
    await env.DB.prepare("SELECT * FROM user_stats WHERE user_id = 'reward-user'").first(),
  ).toEqual(stats);
  expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({ results: [] });
  expect(
    await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_product_game_reward_daily'",
    ).first(),
  ).not.toBeNull();
  expect(await settleGameRewards(env.DB, completion('after-migration', 'undercover'))).toEqual([
    expect.objectContaining({ userId: 'reward-user', xpEarned: 5, normalDrawsEarned: 1 }),
  ]);
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

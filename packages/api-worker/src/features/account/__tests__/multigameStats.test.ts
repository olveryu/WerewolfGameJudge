import { fibEngine } from '@game-judge/game-engine/games/fibking/public';
import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { avalonEffectSchema } from '../../../games/avalon/effects';
import {
  avalonStatsSettlement,
  getAvalonPublicUserStats,
} from '../../../games/avalon/publicUserStats';
import { drawGuessEffectSchema } from '../../../games/drawguess/effects';
import {
  drawGuessStatsSettlement,
  getDrawGuessPublicUserStats,
} from '../../../games/drawguess/publicUserStats';
import { fibEffectSchema, handleFibEffect } from '../../../games/fibking/effects';
import { fibStatsSettlement, getFibPublicUserStats } from '../../../games/fibking/publicUserStats';
import {
  getPictionaryPublicUserStats,
  pictionaryStatsSettlement,
} from '../../../games/pictionary/publicUserStats';
import { pictionaryEffectSchema } from '../../../games/pictionary/schemas';
import {
  getStoryRelayPublicUserStats,
  storyRelayStatsSettlement,
} from '../../../games/storyrelay/publicUserStats';
import { storyRelayEffectSchema } from '../../../games/storyrelay/schemas';
import {
  getUndercoverPublicUserStats,
  undercoverStatsSettlement,
} from '../../../games/undercover/publicUserStats';
import { undercoverEffectSchema } from '../../../games/undercover/schemas';
import { settleGameRewards } from '../settleGameRewards';

const userId = 'stats-user';
const guest = 'stats-guest';
const completedAt = Date.UTC(2026, 8, 18);

beforeEach(async () => {
  await env.DB.exec(
    'DELETE FROM product_game_reward_results; DELETE FROM product_game_reward_claims; DELETE FROM users;',
  );
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES (?1, 'Player', 0, datetime('now'), datetime('now')),
            (?2, 'Guest', 1, datetime('now'), datetime('now'))`,
  )
    .bind(userId, guest)
    .run();
});

const input = (
  gameType: 'avalon' | 'undercover' | 'drawguess' | 'fibking' | 'pictionary' | 'storyrelay',
  settlementId: string,
) => ({
  settlementId,
  gameType,
  kind: 'completion' as const,
  completedAt,
  participantUserIds: [userId, guest],
});
const draw = (id: string) => ({
  userId: id,
  gamesPlayed: 1 as const,
  guessAttempts: 3,
  guessRounds: 2,
  guessedRounds: 1,
  guessTimeMs: 2000,
  guessTimedRounds: 1,
  drawingRounds: 1,
  guessedDrawingRounds: 1,
  totalScore: 7,
  flowersReceived: 1,
  eggsReceived: 2,
  tomatoesReceived: 3,
});
const fib = (id: string) => ({
  userId: id,
  gamesPlayed: 1 as const,
  guesserRounds: 1,
  honestRounds: 0,
  fibberRounds: 0,
  honestFoundRounds: 1,
  honestRevealedRounds: 0,
  fibberRevealedCount: 0,
});

it('reads empty users and accumulates every game from the migrated database', async () => {
  expect(await getAvalonPublicUserStats(userId, env)).toEqual({
    gameType: 'avalon',
    gamesPlayed: 0,
    roles: [],
  });
  expect(await getUndercoverPublicUserStats(userId, env)).toEqual({
    gameType: 'undercover',
    gamesPlayed: 0,
    roles: [],
  });
  expect(await getDrawGuessPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 0,
    guessAttempts: 0,
  });
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 0,
    guesserRounds: 0,
  });
  expect(await getPictionaryPublicUserStats(userId, env)).toEqual({
    gameType: 'pictionary',
    gamesPlayed: 0,
    textSubmissions: 0,
    drawingSubmissions: 0,
  });
  expect(await getStoryRelayPublicUserStats(userId, env)).toEqual({
    gameType: 'storyrelay',
    gamesPlayed: 0,
    paragraphsSubmitted: 0,
  });

  for (const id of ['one', 'two']) {
    await settleGameRewards(
      env.DB,
      input('avalon', `avalon-${id}`),
      avalonStatsSettlement([
        { userId, role: 'merlin', won: id === 'one' },
        { userId: guest, role: 'assassin', won: false },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('undercover', `undercover-${id}`),
      undercoverStatsSettlement([
        { userId, role: 'civilian', won: true },
        { userId: guest, role: 'undercover', won: false },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('drawguess', `draw-${id}`),
      drawGuessStatsSettlement([draw(userId), draw(guest)]),
    );
    await settleGameRewards(
      env.DB,
      input('fibking', `fib-${id}`),
      fibStatsSettlement([fib(userId), fib(guest)]),
    );
    await settleGameRewards(
      env.DB,
      input('pictionary', `picture-${id}`),
      pictionaryStatsSettlement([
        { userId, gamesPlayed: 1, textSubmissions: 2, drawingSubmissions: 3 },
        { userId: guest, gamesPlayed: 1, textSubmissions: 1, drawingSubmissions: 0 },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('storyrelay', `story-${id}`),
      storyRelayStatsSettlement([
        { userId, gamesPlayed: 1, paragraphsSubmitted: 2 },
        { userId: guest, gamesPlayed: 1, paragraphsSubmitted: 1 },
      ]),
    );
  }
  expect(await getAvalonPublicUserStats(userId, env)).toEqual({
    gameType: 'avalon',
    gamesPlayed: 2,
    roles: [{ role: 'merlin', gamesPlayed: 2, wins: 1 }],
  });
  expect(await getUndercoverPublicUserStats(userId, env)).toEqual({
    gameType: 'undercover',
    gamesPlayed: 2,
    roles: [{ role: 'civilian', gamesPlayed: 2, wins: 2 }],
  });
  expect(await getDrawGuessPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 2,
    guessAttempts: 6,
    guessTimeMs: 4000,
    eggsReceived: 4,
  });
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 2,
    guesserRounds: 2,
    honestFoundRounds: 2,
  });
  expect(await getPictionaryPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 2,
    textSubmissions: 4,
    drawingSubmissions: 6,
  });
  expect(await getStoryRelayPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 2,
    paragraphsSubmitted: 4,
  });
  expect(await getDrawGuessPublicUserStats(guest, env)).toMatchObject({ gamesPlayed: 0 });
});

it('uses one replay boundary for rewards and stats, rejects changed facts and never retroclaims a guest', async () => {
  const reward = input('fibking', 'replay');
  const facts = [fib(userId), fib(guest)];
  const [first, second] = await Promise.all([
    settleGameRewards(env.DB, reward, fibStatsSettlement(facts)),
    settleGameRewards(env.DB, reward, fibStatsSettlement([...facts].reverse())),
  ]);
  expect(first).toEqual(second);
  await env.DB.prepare('UPDATE users SET is_anonymous = 0 WHERE id = ?').bind(guest).run();
  await settleGameRewards(env.DB, reward, fibStatsSettlement(facts));
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({
    gamesPlayed: 1,
    honestFoundRounds: 1,
  });
  expect(await getFibPublicUserStats(guest, env)).toMatchObject({ gamesPlayed: 0 });
  await expect(
    settleGameRewards(
      env.DB,
      reward,
      fibStatsSettlement([{ ...fib(userId), honestFoundRounds: 0 }, fib(guest)]),
    ),
  ).rejects.toThrow();
  await expect(
    settleGameRewards(env.DB, input('fibking', 'missing'), fibStatsSettlement([fib(userId)])),
  ).rejects.toThrow('roster mismatch');
  await expect(
    settleGameRewards(
      env.DB,
      input('fibking', 'duplicate'),
      fibStatsSettlement([fib(userId), fib(userId)]),
    ),
  ).rejects.toThrow('roster mismatch');
});

it('rolls back reward and claim when a game stat violates its constraint', async () => {
  const second = 'stats-user-2';
  await env.DB.prepare(
    "INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at) VALUES (?, 'Second', 0, datetime('now'), datetime('now'))",
  )
    .bind(second)
    .run();
  await expect(
    settleGameRewards(
      env.DB,
      { ...input('fibking', 'invalid'), participantUserIds: [userId, second] },
      fibStatsSettlement([fib(userId), { ...fib(second), guesserRounds: -1 }]),
    ),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT id FROM product_game_reward_claims WHERE id = 'invalid'").first(),
  ).toBeNull();
  expect(
    await env.DB.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').bind(userId).first(),
  ).toBeNull();
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({ gamesPlayed: 0 });
});

it('fails closed when a settled reward ledger row is corrupted', async () => {
  const reward = input('fibking', 'corrupt');
  const stats = fibStatsSettlement([fib(userId), fib(guest)]);
  await settleGameRewards(env.DB, reward, stats);
  await env.DB.prepare(
    "UPDATE product_game_reward_results SET stats_applied = 0 WHERE settlement_id = 'corrupt'",
  ).run();
  await expect(settleGameRewards(env.DB, reward, stats)).rejects.toThrow();
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({ gamesPlayed: 1 });
  expect(
    await env.DB.prepare('SELECT games_played FROM user_stats WHERE user_id = ?')
      .bind(userId)
      .first(),
  ).toEqual({ games_played: 1 });
});

it('accepts legacy completions but rejects v2 without stats in all six decoders', () => {
  const legacy = { roundId: 'old', completedAt, participantUserIds: [userId] };
  const schemas = [
    ['avalon.game.completed', avalonEffectSchema],
    ['undercover.game.completed', undercoverEffectSchema],
    ['drawguess.game.completed', drawGuessEffectSchema],
    ['fibking.game.completed', fibEffectSchema],
    ['pictionary.game.completed', pictionaryEffectSchema],
    ['storyrelay.game.completed', storyRelayEffectSchema],
  ] as const;
  for (const [type, schema] of schemas) {
    expect(schema.safeParse({ type, payload: legacy }).success).toBe(true);
    expect(schema.safeParse({ type, payload: { ...legacy, completionVersion: 2 } }).success).toBe(
      false,
    );
  }
  const examples = [
    ['avalon.game.completed', avalonEffectSchema, { userId, role: 'merlin', won: true }],
    ['undercover.game.completed', undercoverEffectSchema, { userId, role: 'civilian', won: true }],
    ['drawguess.game.completed', drawGuessEffectSchema, draw(userId)],
    ['fibking.game.completed', fibEffectSchema, fib(userId)],
    [
      'pictionary.game.completed',
      pictionaryEffectSchema,
      { userId, gamesPlayed: 1, textSubmissions: 1, drawingSubmissions: 1 },
    ],
    [
      'storyrelay.game.completed',
      storyRelayEffectSchema,
      { userId, gamesPlayed: 1, paragraphsSubmitted: 1 },
    ],
  ] as const;
  for (const [type, schema, fact] of examples) {
    expect(
      schema.safeParse({ type, payload: { ...legacy, completionVersion: 2, stats: [fact] } })
        .success,
    ).toBe(true);
  }
});

it('delivers both in-flight legacy and v2 Fib effects through the owner handler', async () => {
  const context = {
    bindings: env,
    effectId: 'fib-effect',
    state: fibEngine.createInitialState(
      { numberOfPlayers: 4 },
      { roomCode: '4321', hostUserId: userId, nowMs: 1, commandId: 'create' },
    ),
    roomIdentity: { roomId: 'stats-room', roomCode: '4321', creationId: 'stats-creation' },
    createdRevision: 1,
    deliveryAttemptCount: 1,
    dispatchInternal: () => {
      throw new Error('unexpected dispatch');
    },
    publishUserEvent: () => Promise.resolve(),
  };
  const legacy = fibEffectSchema.parse({
    type: 'fibking.game.completed',
    payload: { roundId: 'legacy', completedAt, participantUserIds: [userId, guest] },
  });
  const current = fibEffectSchema.parse({
    type: 'fibking.game.completed',
    payload: {
      roundId: 'current',
      completedAt,
      participantUserIds: [userId, guest],
      completionVersion: 2,
      stats: [fib(userId), fib(guest)],
    },
  });
  await handleFibEffect(legacy, context);
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({ gamesPlayed: 0 });
  await handleFibEffect(current, context);
  await handleFibEffect(current, context);
  expect(await getFibPublicUserStats(userId, env)).toMatchObject({ gamesPlayed: 1 });
  expect(
    await env.DB.prepare('SELECT games_played FROM user_stats WHERE user_id = ?')
      .bind(userId)
      .first(),
  ).toEqual({ games_played: 2 });
});

it('dispatches each public stats endpoint for an authenticated viewer', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sub: userId, ver: 0, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production'));
  for (const gameType of [
    'avalon',
    'undercover',
    'drawguess',
    'fibking',
    'pictionary',
    'storyrelay',
  ]) {
    const response = await SELF.fetch(
      `https://test.local/api/games/${gameType}/users/${userId}/stats`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gameType, gamesPlayed: 0 });
  }
});

it('deletes game rows with their user', async () => {
  await settleGameRewards(
    env.DB,
    input('avalon', 'delete-role'),
    avalonStatsSettlement([
      { userId, role: 'merlin', won: true },
      { userId: guest, role: 'assassin', won: false },
    ]),
  );
  await settleGameRewards(
    env.DB,
    input('undercover', 'delete-undercover'),
    undercoverStatsSettlement([
      { userId, role: 'civilian', won: true },
      { userId: guest, role: 'blank', won: false },
    ]),
  );
  await settleGameRewards(
    env.DB,
    input('drawguess', 'delete-draw'),
    drawGuessStatsSettlement([draw(userId), draw(guest)]),
  );
  await settleGameRewards(
    env.DB,
    input('fibking', 'delete-count'),
    fibStatsSettlement([fib(userId), fib(guest)]),
  );
  await settleGameRewards(
    env.DB,
    input('pictionary', 'delete-picture'),
    pictionaryStatsSettlement([
      { userId, gamesPlayed: 1, textSubmissions: 1, drawingSubmissions: 0 },
      { userId: guest, gamesPlayed: 1, textSubmissions: 1, drawingSubmissions: 0 },
    ]),
  );
  await settleGameRewards(
    env.DB,
    input('storyrelay', 'delete-story'),
    storyRelayStatsSettlement([
      { userId, gamesPlayed: 1, paragraphsSubmitted: 1 },
      { userId: guest, gamesPlayed: 1, paragraphsSubmitted: 1 },
    ]),
  );
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  for (const table of [
    'avalon_user_stats',
    'undercover_user_stats',
    'drawguess_user_stats',
    'fibking_user_stats',
    'pictionary_user_stats',
    'storyrelay_user_stats',
  ]) {
    expect(
      await env.DB.prepare(`SELECT user_id FROM ${table} WHERE user_id = ?`).bind(userId).first(),
    ).toBeNull();
  }
});

it('enforces role validity, integral counts and wins no greater than games', async () => {
  await expect(
    env.DB.prepare(
      "INSERT INTO avalon_user_stats (user_id, role, games_played, wins) VALUES (?, 'merlin', 1, 2)",
    )
      .bind(userId)
      .run(),
  ).rejects.toThrow();
  await expect(
    env.DB.prepare(
      "INSERT INTO undercover_user_stats (user_id, role, games_played, wins) VALUES (?, 'unknown', 1, 0)",
    )
      .bind(userId)
      .run(),
  ).rejects.toThrow();
  await expect(
    env.DB.prepare(
      'INSERT INTO storyrelay_user_stats (user_id, games_played, paragraphs_submitted) VALUES (?, 1, 1.5)',
    )
      .bind(userId)
      .run(),
  ).rejects.toThrow();
});

it.each([50, 1000])(
  'keeps keyed reads and settlement writes bounded among %i accounts',
  async (size) => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < ?1)
     INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     SELECT 'fixture-' || i, 'Fixture', 0, datetime('now'), datetime('now') FROM n`,
    )
      .bind(size)
      .run();
    await env.DB.prepare(
      `INSERT INTO fibking_user_stats (user_id, games_played, guesser_rounds, honest_rounds, fibber_rounds, honest_found_rounds, honest_revealed_rounds, fibber_revealed_count)
     SELECT id, 1000, 1000, 0, 0, 100, 0, 0 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO avalon_user_stats (user_id, role, games_played, wins)
     SELECT id, 'merlin', 1000, 500 FROM users WHERE id LIKE 'fixture-%'
     UNION ALL SELECT id, 'assassin', 1000, 500 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO undercover_user_stats (user_id, role, games_played, wins)
     SELECT id, 'civilian', 1000, 500 FROM users WHERE id LIKE 'fixture-%'
     UNION ALL SELECT id, 'undercover', 1000, 500 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO drawguess_user_stats (user_id, games_played, guess_attempts, guess_rounds, guessed_rounds, guess_time_ms, guess_timed_rounds, drawing_rounds, guessed_drawing_rounds, total_score, flowers_received, eggs_received, tomatoes_received)
     SELECT id, 1000, 1000, 1000, 500, 500000, 500, 1000, 500, 1000, 10, 10, 10 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO pictionary_user_stats (user_id, games_played, text_submissions, drawing_submissions)
     SELECT id, 1000, 1000, 1000 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO storyrelay_user_stats (user_id, games_played, paragraphs_submitted)
     SELECT id, 1000, 1000 FROM users WHERE id LIKE 'fixture-%'`,
    ).run();
    await settleGameRewards(
      env.DB,
      input('fibking', `warm-${size}`),
      fibStatsSettlement([fib(userId), fib(guest)]),
    );
    await settleGameRewards(
      env.DB,
      input('avalon', `warm-role-${size}`),
      avalonStatsSettlement([
        { userId, role: 'merlin', won: true },
        { userId: guest, role: 'assassin', won: false },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('avalon', `warm-role-2-${size}`),
      avalonStatsSettlement([
        { userId, role: 'assassin', won: false },
        { userId: guest, role: 'merlin', won: true },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('undercover', `warm-undercover-${size}`),
      undercoverStatsSettlement([
        { userId, role: 'civilian', won: true },
        { userId: guest, role: 'blank', won: false },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('undercover', `warm-undercover-2-${size}`),
      undercoverStatsSettlement([
        { userId, role: 'undercover', won: false },
        { userId: guest, role: 'blank', won: true },
      ]),
    );
    await settleGameRewards(
      env.DB,
      input('drawguess', `warm-draw-${size}`),
      drawGuessStatsSettlement([draw(userId), draw(guest)]),
    );
    const pictureFacts = [
      { userId, gamesPlayed: 1 as const, textSubmissions: 1, drawingSubmissions: 1 },
      { userId: guest, gamesPlayed: 1 as const, textSubmissions: 1, drawingSubmissions: 1 },
    ];
    const storyFacts = [
      { userId, gamesPlayed: 1 as const, paragraphsSubmitted: 1 },
      { userId: guest, gamesPlayed: 1 as const, paragraphsSubmitted: 1 },
    ];
    await settleGameRewards(
      env.DB,
      input('pictionary', `warm-picture-${size}`),
      pictionaryStatsSettlement(pictureFacts),
    );
    await settleGameRewards(
      env.DB,
      input('storyrelay', `warm-story-${size}`),
      storyRelayStatsSettlement(storyFacts),
    );
    const measured = createRowCountingDb(env.DB);
    const bindings = { ...env, DB: measured.db };
    const checks = [
      {
        read: () => getFibPublicUserStats(userId, bindings),
        legacy: () => settleGameRewards(measured.db, input('fibking', `legacy-fib-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('fibking', `budget-fib-${size}`),
            fibStatsSettlement([fib(userId), fib(guest)]),
          ),
        readBudget: 2,
      },
      {
        read: () => getAvalonPublicUserStats(userId, bindings),
        legacy: () => settleGameRewards(measured.db, input('avalon', `legacy-avalon-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('avalon', `budget-avalon-${size}`),
            avalonStatsSettlement([
              { userId, role: 'merlin', won: true },
              { userId: guest, role: 'assassin', won: false },
            ]),
          ),
        readBudget: 3,
      },
      {
        read: () => getUndercoverPublicUserStats(userId, bindings),
        legacy: () =>
          settleGameRewards(measured.db, input('undercover', `legacy-undercover-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('undercover', `budget-undercover-${size}`),
            undercoverStatsSettlement([
              { userId, role: 'civilian', won: true },
              { userId: guest, role: 'blank', won: false },
            ]),
          ),
        readBudget: 3,
      },
      {
        read: () => getDrawGuessPublicUserStats(userId, bindings),
        legacy: () => settleGameRewards(measured.db, input('drawguess', `legacy-draw-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('drawguess', `budget-draw-${size}`),
            drawGuessStatsSettlement([draw(userId), draw(guest)]),
          ),
        readBudget: 2,
      },
      {
        read: () => getPictionaryPublicUserStats(userId, bindings),
        legacy: () => settleGameRewards(measured.db, input('pictionary', `legacy-picture-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('pictionary', `budget-picture-${size}`),
            pictionaryStatsSettlement(pictureFacts),
          ),
        readBudget: 2,
      },
      {
        read: () => getStoryRelayPublicUserStats(userId, bindings),
        legacy: () => settleGameRewards(measured.db, input('storyrelay', `legacy-story-${size}`)),
        write: () =>
          settleGameRewards(
            measured.db,
            input('storyrelay', `budget-story-${size}`),
            storyRelayStatsSettlement(storyFacts),
          ),
        readBudget: 2,
      },
    ];
    for (const check of checks) {
      measured.reset();
      await check.read();
      expect(measured.counts.rowsRead).toBeLessThanOrEqual(check.readBudget);
      measured.reset();
      await check.legacy();
      const legacyWrites = measured.counts.rowsWritten;
      expect(legacyWrites).toBeLessThanOrEqual(10);
      measured.reset();
      await check.write();
      // One registered participant adds one cumulative row to the legacy reward batch.
      expect(measured.counts.rowsWritten).toBe(legacyWrites + 1);
      expect(measured.counts.rowsWritten).toBeLessThanOrEqual(11);
      expect(measured.counts.rowsRead).toBeLessThanOrEqual(30);
    }
  },
);

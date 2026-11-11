/**
 * Contract: the shared draw against a real D1, through a loader the test owns.
 * Game-specific behaviour (snapshots, replay, row budgets) is pinned in each
 * game's own selection tests; this file pins what every caller relies on.
 */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { drawWords, recordSeenWords, WORD_DRAW_ALL_PARTITION } from '../wordDraw';

const PLAYER = 'word-draw-player-1';
const OTHER_PLAYER = 'word-draw-player-2';

async function seedWords(count: number): Promise<number[]> {
  await env.DB.prepare(
    `WITH RECURSIVE counter(position) AS (
       SELECT 1 UNION ALL SELECT position + 1 FROM counter WHERE position < ?)
     INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
     SELECT 'draw-' || position, '题' || position, 't', '动物', 'easy', 'active', datetime('now')
     FROM counter`,
  )
    .bind(count)
    .run();
  const rows = await env.DB.prepare(
    'SELECT draw_ordinal FROM drawguess_words ORDER BY draw_ordinal',
  ).all<{ draw_ordinal: number }>();
  return rows.results.map((row) => row.draw_ordinal);
}

/** Loader over drawguess_words that reports which ordinals each call asked for. */
function createLoader() {
  const requested: number[][] = [];
  const loadItems = async (ordinals: readonly number[]): Promise<ReadonlyMap<number, string>> => {
    requested.push([...ordinals]);
    const rows = await env.DB.prepare(
      `SELECT draw_ordinal, word FROM drawguess_words
       WHERE draw_ordinal IN (${ordinals.map(() => '?').join(', ')})`,
    )
      .bind(...ordinals)
      .all<{ draw_ordinal: number; word: string }>();
    return new Map(rows.results.map((row) => [row.draw_ordinal, row.word]));
  };
  return { requested, loadItems };
}

function draw(participantUserIds: readonly string[], count = 1) {
  return drawWords({
    db: env.DB,
    pool: 'drawguess',
    partition: WORD_DRAW_ALL_PARTITION,
    participantUserIds,
    count,
    seenPolicy: 'excludeSeen',
    loadItems: createLoader().loadItems,
  });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare("DELETE FROM users WHERE id LIKE 'word-draw-player-%'"),
    env.DB.prepare('INSERT INTO users (id) VALUES (?), (?)').bind(PLAYER, OTHER_PLAYER),
  ]);
});

describe('drawWords', () => {
  it('reports an empty partition and an exhausted one apart', async () => {
    expect(await draw([PLAYER])).toEqual({ kind: 'exhausted', poolSize: 0 });
    const ordinals = await seedWords(2);
    await recordSeenWords({ db: env.DB, pool: 'drawguess', userIds: [PLAYER], ordinals });
    expect(await draw([PLAYER])).toEqual({ kind: 'exhausted', poolSize: 2 });
  });

  it('treats a word as seen when any participant has seen it', async () => {
    const [first, second, third] = await seedWords(3);
    if (first === undefined || second === undefined || third === undefined) throw new Error('seed');
    await recordSeenWords({ db: env.DB, pool: 'drawguess', userIds: [PLAYER], ordinals: [first] });
    await recordSeenWords({
      db: env.DB,
      pool: 'drawguess',
      userIds: [OTHER_PLAYER],
      ordinals: [second],
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await draw([PLAYER, OTHER_PLAYER]);
      expect(result.kind === 'drawn' && result.picks.map((pick) => pick.ordinal)).toEqual([third]);
    }
  });

  it('returns fewer words than asked when the pool cannot supply them', async () => {
    await seedWords(2);
    const result = await draw([PLAYER], 5);
    expect(result.kind === 'drawn' && result.picks).toHaveLength(2);
  });

  it('draws without a seen filter when there are no participants', async () => {
    await seedWords(1);
    const result = await draw([]);
    expect(result.kind === 'drawn' && result.picks).toHaveLength(1);
  });

  it('redraws past a stale index entry instead of failing', async () => {
    const [onlyWord] = await seedWords(1);
    // An index entry whose word no longer exists: the loader returns nothing for it.
    await env.DB.prepare(
      `UPDATE word_draw_index SET members = members || '987654321,'
       WHERE pool = 'drawguess' AND partition_key = 'all'`,
    ).run();
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await draw([PLAYER]);
        expect(result.kind === 'drawn' && result.picks.map((pick) => pick.ordinal)).toEqual([
          onlyWord,
        ]);
      }
    } finally {
      await env.DB.prepare(
        `UPDATE word_draw_index SET members = replace(members, ',987654321,', ',')
         WHERE pool = 'drawguess' AND partition_key = 'all'`,
      ).run();
    }
  });

  it('asks the loader for more candidates after a rejection', async () => {
    await seedWords(6);
    const loader = createLoader();
    const result = await drawWords({
      db: env.DB,
      pool: 'drawguess',
      partition: WORD_DRAW_ALL_PARTITION,
      participantUserIds: [PLAYER],
      count: 1,
      seenPolicy: 'excludeSeen',
      // The game refuses every candidate.
      loadItems: async (ordinals) => {
        await loader.loadItems(ordinals);
        return new Map();
      },
    });
    expect(result).toEqual({ kind: 'exhausted', poolSize: 6 });
    expect(loader.requested.map((batch) => batch.length)).toEqual([1, 2, 3]);
    expect(new Set(loader.requested.flat()).size).toBe(6);
  });

  it('fails fast on an unknown partition and on an invalid count', async () => {
    await expect(
      drawWords({
        db: env.DB,
        pool: 'drawguess',
        partition: 'no-such-partition',
        participantUserIds: [PLAYER],
        count: 1,
        seenPolicy: 'excludeSeen',
        loadItems: createLoader().loadItems,
      }),
    ).rejects.toThrow('Word draw index is missing for drawguess/no-such-partition');
    await expect(draw([PLAYER], 0)).rejects.toThrow('count must be a positive integer');
  });
});

describe('recordSeenWords', () => {
  it('keeps each pool separate for the same account', async () => {
    await recordSeenWords({ db: env.DB, pool: 'drawguess', userIds: [PLAYER], ordinals: [4] });
    await recordSeenWords({ db: env.DB, pool: 'undercover', userIds: [PLAYER], ordinals: [9] });
    await recordSeenWords({ db: env.DB, pool: 'drawguess', userIds: [PLAYER], ordinals: [4, 5] });
    const rows = await env.DB.prepare(
      'SELECT pool, seen FROM word_seen WHERE user_id = ? ORDER BY pool',
    )
      .bind(PLAYER)
      .all();
    expect(rows.results).toEqual([
      { pool: 'drawguess', seen: ',4,5,' },
      { pool: 'undercover', seen: ',9,' },
    ]);
  });

  it('removes the seen record with the account', async () => {
    await recordSeenWords({ db: env.DB, pool: 'drawguess', userIds: [PLAYER], ordinals: [4] });
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(PLAYER).run();
    expect(
      await env.DB.prepare('SELECT seen FROM word_seen WHERE user_id = ?').bind(PLAYER).first(),
    ).toBeNull();
  });
});

/** Real D1 publication contracts: quota, immutable ordering, and replay-safe accounting. */
import { FIB_WORD_CATEGORY_IDS } from '@game-judge/game-engine/games/fibking/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { cleanupFibWordAudit } from '../maintenance';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  reserveFibWordPack,
  selectFibWordSearch,
} from '../wordPublication';
import { FIB_WORD_SEARCHES } from '../wordSearchPlan';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_round_word_selections'),
    env.DB.prepare('DELETE FROM fib_word_usages'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('Fib word publication', () => {
  it('keeps the manually selected category and rotates its concrete queries', async () => {
    for (const category of FIB_WORD_CATEGORY_IDS) {
      expect(
        FIB_WORD_SEARCHES.filter((search) => search.category === category).length,
      ).toBeGreaterThanOrEqual(2);
    }
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at)
       VALUES ('existing', '旧词', '原本的准确释义', '原本的使用提示', 'astronomy', 'local',
         'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 'first', 'astronomy');
    if (pack === null) throw new Error('Expected reservation');
    expect(
      await env.DB.prepare('SELECT search_index, category FROM fib_word_packs WHERE id = ?')
        .bind(pack.id)
        .first(),
    ).toEqual({ search_index: null, category: 'astronomy' });
    const first = await selectFibWordSearch(env.DB, pack);
    expect(first.category).toBe('astronomy');
    expect(await selectFibWordSearch(env.DB, pack)).toEqual(first);
    const nextPack = await reserveFibWordPack(env.DB, '2026-09-01', 'second', 'astronomy');
    if (nextPack === null) throw new Error('Expected next reservation');
    const next = await selectFibWordSearch(env.DB, nextPack);
    expect(next.category).toBe(first.category);
    expect(next.searchIndex).not.toBe(first.searchIndex);
  });

  it('does not replace the manually selected category with an inventory-based choice', async () => {
    const selectedCategory = FIB_WORD_CATEGORY_IDS[0];
    if (selectedCategory === undefined) throw new Error('Expected Fib categories');
    const pack = await reserveFibWordPack(env.DB, '2026-09-02', 'first', selectedCategory);
    if (pack === null) throw new Error('Expected reservation');
    expect(pack.category).toBe(selectedCategory);
    expect((await selectFibWordSearch(env.DB, pack)).category).toBe(selectedCategory);
  });

  it('does not assign searches at reservation time', async () => {
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 'first', 'customs')).not.toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 'first', 'customs')).toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-02', 'first', 'customs')).not.toBeNull();
    expect(
      (
        await env.DB.prepare(
          'SELECT search_index FROM fib_word_packs WHERE search_index IS NOT NULL',
        ).all()
      ).results,
    ).toEqual([]);
  });

  it('does not resend an uncertain external request after a restart', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 'first', 'customs');
    if (pack === null) throw new Error('Expected pack reservation');
    await claimFibWordProviderRequest(env.DB, pack, 'discovery');
    await expect(claimFibWordProviderRequest(env.DB, pack, 'discovery')).rejects.toThrow(
      'already consumed',
    );
  });

  it('caps search and extraction together without spending the model reservations', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 'first', 'customs');
    if (pack === null) throw new Error('Expected pack reservation');
    for (const operation of [
      'discovery',
      'extraction',
      'verification-0',
      'verification-extraction-0',
      'verification-1',
      'verification-extraction-1',
      'verification-2',
    ] as const) {
      await claimFibWordProviderRequest(env.DB, pack, operation);
    }
    await expect(
      claimFibWordProviderRequest(env.DB, pack, 'verification-extraction-2'),
    ).rejects.toThrow('budget exhausted');
    await claimFibWordProviderRequest(env.DB, pack, 'generation');
    await claimFibWordProviderRequest(env.DB, pack, 'review');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_provider_requests').first(),
    ).toEqual({ count: 9 });
  });

  it('refuses new work when capacity is paused', async () => {
    await env.DB.prepare("UPDATE database_capacity SET state = 'paused' WHERE id = 1").run();
    expect(await reserveFibWordPack(env.DB, '2026-11-01', 'first', 'customs')).toBeNull();
  });

  it('reserves a new pack after a failed pack without consuming any monthly counter', async () => {
    const firstPack = await reserveFibWordPack(env.DB, '2026-08-01', 'first', 'customs');
    if (firstPack === null) throw new Error('Expected editorial pack');
    await failFibWordPack(env.DB, firstPack, 'generation:timedOut');
    const secondPack = await reserveFibWordPack(env.DB, '2026-08-01', 'second', 'customs');
    expect(secondPack).not.toBeNull();
    expect(secondPack?.id).toBe('2026-08-01-second');
    // The month row is only the foreign-key parent for pack month ids; its
    // counters are dead — no quota is consumed by reserving or failing.
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 0, published_count: 0 });
  });

  it('expires orphaned word usages older than the retention window and keeps recent ones', async () => {
    // The candidate tables are dropped (0085), so retention only covers
    // usages now: an old usage from a room that no longer exists is
    // deleted, a recent one is kept.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_usages (room_creation_id, round_id, word, source, used_at, participant_count)
         VALUES ('room-old', 'round-1', '旧词', 'local', '2026-06-01T00:00:00.000Z', 3)`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_usages (room_creation_id, round_id, word, source, used_at, participant_count)
         VALUES ('room-new', 'round-1', '新词', 'local', '2026-09-01T00:00:00.000Z', 3)`,
      ),
    ]);
    await cleanupFibWordAudit(env.DB, Date.parse('2026-09-11T00:00:00.000Z'));
    expect((await env.DB.prepare('SELECT word FROM fib_word_usages').all()).results).toEqual([
      { word: '新词' },
    ]);
  });
});

describe('Fib word run-id reservation', () => {
  it('gives each run its own pack id from the run id and refuses a replay', async () => {
    const first = await reserveFibWordPack(env.DB, '2026-10-01', 'run-1', 'customs');
    if (first === null) throw new Error('Expected reservation');
    expect(first.id).toBe('2026-10-01-run-1');
    const second = await reserveFibWordPack(env.DB, '2026-10-01', 'run-2', 'customs');
    expect(second?.id).toBe('2026-10-01-run-2');
    // The same run id replays the same pack id, which is already taken.
    await expect(reserveFibWordPack(env.DB, '2026-10-01', 'run-1', 'customs')).resolves.toBeNull();
    // A repeated manual run on the same day gets its own id.
    const third = await reserveFibWordPack(env.DB, '2026-10-02', 'run-1', 'customs');
    expect(third?.id).toBe('2026-10-02-run-1');
  });
});

/** Critical query indexes must survive the complete D1 migration chain, including table rebuilds. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('word supply D1 index contract', () => {
  it.each([
    ['drawguess_word_packs', ['category', 'created_at']],
    ['undercover_word_packs', ['category', 'created_at']],
    ['drawguess_words', ['category', 'status']],
    ['fib_word_candidate_reviews', ['reviewed_at']],
    ['fib_word_usages', ['used_at']],
    ['editorial_model_requests', ['claimed_at']],
  ])('preserves an index beginning with %s %j', async (table, columns) => {
    const indexes = await env.DB.prepare('SELECT name, partial FROM pragma_index_list(?)')
      .bind(table)
      .all<{ name: string; partial: number }>();
    const indexColumns = await Promise.all(
      indexes.results
        .filter((index) => index.partial === 0)
        .map(async (index) => {
          const result = await env.DB.prepare(
            'SELECT name FROM pragma_index_info(?) ORDER BY seqno',
          )
            .bind(index.name)
            .all<{ name: string | null }>();
          return result.results.map((column) => column.name);
        }),
    );
    expect(indexColumns.some((index) => columns.every((column, i) => index[i] === column))).toBe(
      true,
    );
  });
});

/** Regression test for D6: migration 0081 backfills the operation of every
 * historical editorial_model_requests row from its claim id. The ids are the
 * only operation signal the ledger ever carried, so the CASE must classify
 * every id shape the five claim sites produce: external reviews
 * (`submission:*`), fib and shared-workflow `:review` claims, fib history
 * classification, and both generation shapes. The ALTER is not re-runnable
 * (the column already exists after setup), so this test re-applies only the
 * migration's UPDATE over seeded rows. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0081_editorial_model_operation.sql';

function requireBackfillUpdate(): string {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined)
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  const updates = migration.queries.filter((query) =>
    query.trimStart().toUpperCase().startsWith('UPDATE'),
  );
  if (updates.length !== 1)
    throw new Error(
      `[FAIL-FAST] Expected exactly one UPDATE in ${MIGRATION_NAME}, found ${updates.length}`,
    );
  return updates[0];
}

describe('editorial model operation backfill', () => {
  it('classifies every historical claim id shape', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const ids = [
      'submission:act-1:0',
      'fib:pack-1:generation',
      'fib:pack-1:review',
      'fib:history:2026-11-01',
      'undercover:pack-2:generation',
      'undercover:pack-2:review',
    ];
    await env.DB.batch(
      ids.map((id) =>
        env.DB.prepare(
          `INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
           VALUES (?, 'test', 'model', '2026-09-22T12:00:00.000Z')`,
        ).bind(id),
      ),
    );
    // Seeded rows carry the migration default until the backfill runs.
    const before = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM editorial_model_requests WHERE operation <> ?',
    )
      .bind('generation')
      .first<{ n: number }>();
    expect(before?.n).toBe(0);

    await env.DB.prepare(requireBackfillUpdate()).run();

    const rows = await env.DB.prepare(
      'SELECT id, operation FROM editorial_model_requests ORDER BY id',
    ).all<{ id: string; operation: string }>();
    expect(rows.results).toEqual([
      { id: 'fib:history:2026-11-01', operation: 'generation' },
      { id: 'fib:pack-1:generation', operation: 'generation' },
      { id: 'fib:pack-1:review', operation: 'review' },
      { id: 'submission:act-1:0', operation: 'review' },
      { id: 'undercover:pack-2:generation', operation: 'generation' },
      { id: 'undercover:pack-2:review', operation: 'review' },
    ]);
  });
});

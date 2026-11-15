/** Regression test for the unendorse action: migration 0084 must apply on a
 * database that already holds word_submission_events rows. The events table
 * references word_submission_actions, so the old DROP TABLE failed with
 * FOREIGN KEY constraint failed on any populated database (an empty test
 * database could not catch it). The fix rebuilds events without REFERENCES
 * first and restores them afterwards; this test re-applies the migration
 * over seeded rows and asserts the rows, the AUTOINCREMENT sequence, the
 * restored foreign keys and the new action value survive. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0084_word_submission_unendorse.sql';

function requireMigration() {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined || migration.queries.length === 0)
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  return migration;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
    env.DB.prepare(
      `INSERT INTO word_submission_agents
       (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
       VALUES ('agent-1', 'Muse', '', '["fibking"]', 'active', 1000, 1000, '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_batches
       (id, agent_id, game, idempotency_key, request_hash, created_at)
       VALUES ('batch-1', 'agent-1', 'fibking', 'key-1', 'hash-1', '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_items
       (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status, revision)
       VALUES ('item-1', 'batch-1', 'fibking', 'c1', 'idn-1', 'hash-1', 't', 'cat', '{}', 'approved', 0)`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_actions
       (id, batch_id, action, request_hash, items_json, reason, status, created_at)
       VALUES ('act-1', 'batch-1', 'endorse', 'rh-1', '[]', '人工批准进入审核。', 'complete', '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_events
       (action_id, item_id, action, actor, reason, created_at)
       VALUES ('act-1', 'item-1', 'endorse', 'shared-admin', '人工批准进入审核。', '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_events
       (action_id, item_id, action, actor, reason, created_at)
       VALUES ('act-1', NULL, 'endorse', 'shared-admin', '人工批准进入审核。', '2026-11-14T00:00:00Z')`,
    ),
  ]);
});

describe('word submission unendorse migration', () => {
  it('applies on a database with event rows and preserves them', async () => {
    await env.DB.batch(requireMigration().queries.map((query) => env.DB.prepare(query)));

    const events = await env.DB.prepare(
      'SELECT id, action_id, item_id FROM word_submission_events ORDER BY id',
    ).all();
    expect(events.results).toEqual([
      { id: 1, action_id: 'act-1', item_id: 'item-1' },
      { id: 2, action_id: 'act-1', item_id: null },
    ]);

    const seq = await env.DB.prepare(
      "SELECT seq FROM sqlite_sequence WHERE name = 'word_submission_events'",
    ).first<{ seq: number }>();
    expect(seq?.seq).toBe(2);

    const tableSql = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'word_submission_events'",
    ).first<{ sql: string }>();
    expect(tableSql?.sql).toContain('REFERENCES word_submission_actions(id)');
    expect(tableSql?.sql).toContain('REFERENCES word_submission_items(id)');

    // Foreign keys are enforced again after the restore.
    await expect(
      env.DB.prepare(
        `INSERT INTO word_submission_events
         (action_id, item_id, action, actor, reason, created_at)
         VALUES ('bogus', NULL, 'review', 'shared-admin', '', '2026-11-14T00:00:00Z')`,
      ).run(),
    ).rejects.toThrow(/FOREIGN KEY/i);

    // The new action value the migration adds is accepted.
    await env.DB.prepare(
      `INSERT INTO word_submission_actions
       (id, batch_id, action, request_hash, items_json, reason, status, created_at)
       VALUES ('act-2', 'batch-1', 'unendorse', 'rh-2', '[]', '', 'complete', '2026-11-14T00:00:00Z')`,
    ).run();

    // The pre-existing endorse action still inserts.
    await env.DB.prepare(
      `INSERT INTO word_submission_actions
       (id, batch_id, action, request_hash, items_json, reason, status, created_at)
       VALUES ('act-3', 'batch-1', 'endorse', 'rh-3', '[]', '', 'complete', '2026-11-14T00:00:00Z')`,
    ).run();

    // The CHECK whitelist itself is pinned: an unknown action is rejected.
    await expect(
      env.DB.prepare(
        `INSERT INTO word_submission_actions
         (id, batch_id, action, request_hash, items_json, reason, status, created_at)
         VALUES ('act-4', 'batch-1', 'bogus', 'rh-4', '[]', '', 'complete', '2026-11-14T00:00:00Z')`,
      ).run(),
    ).rejects.toThrow(/CHECK constraint/i);

    // The count triggers were untouched by this migration.
    const triggers = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'word_submission_items%'",
    ).all();
    expect(triggers.results.map((row) => (row as { name: string }).name).sort()).toEqual([
      'word_submission_items_close',
      'word_submission_items_insert',
      'word_submission_items_status_counts',
    ]);
  });
});

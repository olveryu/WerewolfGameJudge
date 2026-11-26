/** Current-schema contract for the endorsement values (introduced by 0079):
 * word_submission_events keeps both foreign keys enforced, items accept the
 * approved status, actions accept endorse, and the item count triggers exist.
 * Runs on the full migration chain applied by test/applyMigrations.ts. */
import { FIB_WORD_CATEGORY_IDS } from '@game-judge/game-engine/games/fibking/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(async () => {
  await env.DB.batch([
    // Delete dependents first: events reference items/actions, control
    // events and credentials reference agents (the 0085 system agent owns
    // a synthetic credential and its insert triggers wrote control events,
    // so agents cannot be deleted bare).
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    // The system agent points at its credential: clear the reference before
    // deleting credentials, or the FK blocks the cleanup.
    env.DB.prepare('UPDATE word_submission_agents SET current_credential_id = NULL'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    // Daily usage rows reference agents; delete them before the agents.
    env.DB.prepare('DELETE FROM word_submission_daily_usage'),
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
       VALUES ('item-1', 'batch-1', 'fibking', 'c1', 'idn-1', 'hash-1', 't', ?, '{}', 'pending', 0)`,
    ).bind(FIB_WORD_CATEGORY_IDS[0]),
    env.DB.prepare(
      `INSERT INTO word_submission_actions
       (id, batch_id, action, request_hash, items_json, reason, status, created_at)
       VALUES ('act-1', 'batch-1', 'review', 'rh-1', '[]', '', 'complete', '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_events
       (action_id, item_id, action, actor, reason, created_at)
       VALUES ('act-1', 'item-1', 'review', 'shared-admin', '', '2026-11-14T00:00:00Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO word_submission_events
       (action_id, item_id, action, actor, reason, created_at)
       VALUES ('act-1', NULL, 'review', 'shared-admin', '', '2026-11-14T00:00:00Z')`,
    ),
  ]);
});

describe('word submission endorsement schema', () => {
  it('keeps event foreign keys, the approved status, endorse actions and the count triggers', async () => {
    const foreignKeys = await env.DB.prepare(
      `SELECT "table" AS parent, "from" AS child_column, "to" AS parent_column
       FROM pragma_foreign_key_list('word_submission_events') ORDER BY parent`,
    ).all();
    expect(foreignKeys.results).toEqual([
      { parent: 'word_submission_actions', child_column: 'action_id', parent_column: 'id' },
      { parent: 'word_submission_items', child_column: 'item_id', parent_column: 'id' },
    ]);

    // Event foreign keys are enforced.
    await expect(
      env.DB.prepare(
        `INSERT INTO word_submission_events
         (action_id, item_id, action, actor, reason, created_at)
         VALUES ('bogus', NULL, 'review', 'shared-admin', '', '2026-11-14T00:00:00Z')`,
      ).run(),
    ).rejects.toThrow(/FOREIGN KEY/i);

    // The approved status and the endorse action are accepted.
    await env.DB.prepare(
      "UPDATE word_submission_items SET status = 'approved' WHERE id = 'item-1'",
    ).run();
    const item = await env.DB.prepare(
      "SELECT status FROM word_submission_items WHERE id = 'item-1'",
    ).first<{ status: string }>();
    expect(item?.status).toBe('approved');
    await env.DB.prepare(
      `INSERT INTO word_submission_actions
       (id, batch_id, action, request_hash, items_json, reason, status, created_at)
       VALUES ('act-2', 'batch-1', 'endorse', 'rh-2', '[]', '', 'complete', '2026-11-14T00:00:00Z')`,
    ).run();

    // The item count triggers exist.
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

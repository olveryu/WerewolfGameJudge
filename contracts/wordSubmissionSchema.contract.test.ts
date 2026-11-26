import { DatabaseSync } from 'node:sqlite';

import { expect, it } from 'vitest';

import { applyMigrationsThrough, latestMigrationName } from './support/d1Migrations';

/** Current-schema contracts for word submissions, run on the full migration chain. */

it('records authorization edits and deletion as control events and keeps revoked agents and actions closed', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    applyMigrationsThrough(database, latestMigrationName());
    database.exec(`
      INSERT INTO word_submission_agents
        (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
      VALUES ('agent', 'Muse', '', '["drawguess"]', 'active', 10, 10, '2026-11-13T00:00:00.000Z');
      INSERT INTO word_submission_credentials
        (id, agent_id, token_hash, prefix, expires_at, created_at)
      VALUES ('credential', 'agent', 'test-hash', 'wst_test', '2026-12-13T00:00:00.000Z', '2026-11-13T00:00:00.000Z');
      UPDATE word_submission_agents SET status = 'paused' WHERE id = 'agent';
      UPDATE word_submission_limits SET accepting = 0 WHERE id = 1;
      INSERT INTO word_submission_batches
        (id, agent_id, game, idempotency_key, request_hash, created_at)
      VALUES ('batch', 'agent', 'drawguess', 'test-key', 'test-hash', '2026-11-13T00:00:00.000Z');
      UPDATE sqlite_sequence SET seq = 900 WHERE name = 'word_submission_control_events';
    `);
    expect(
      database.prepare("SELECT agent_id FROM word_submission_batches WHERE id = 'batch'").get(),
    ).toEqual({ agent_id: 'agent' });
    database.exec(`
      UPDATE word_submission_agents SET name = 'Updated Muse' WHERE id = 'agent';
      UPDATE word_submission_credentials SET expires_at = '2027-01-13T00:00:00.000Z' WHERE id = 'credential';
      UPDATE word_submission_agents SET status = 'revoked' WHERE id = 'agent';
      UPDATE word_submission_agents SET deleted_at = '2026-11-13T00:01:00.000Z' WHERE id = 'agent';
    `);
    expect(
      database
        .prepare('SELECT id, action FROM word_submission_control_events WHERE id > 900 ORDER BY id')
        .all(),
    ).toEqual([
      { id: 901, action: 'agent_updated' },
      { id: 902, action: 'credential_expiry_changed' },
      { id: 903, action: 'agent_status_changed' },
      { id: 904, action: 'agent_deleted' },
    ]);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(() =>
      database.exec("UPDATE word_submission_agents SET status = 'active' WHERE id = 'agent'"),
    ).toThrow();
    expect(() =>
      database.exec(`
      INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
      VALUES ('agent', 'unknown', 'shared-admin', '{}', '2026-11-13T00:02:00.000Z')
    `),
    ).toThrow();
  } finally {
    database.close();
  }
});

it.each([1, 1000])(
  'maintains submission counters, the event sequence and foreign keys for %i linked editorial records',
  (count) => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON');
      applyMigrationsThrough(database, latestMigrationName());
      database.exec(`
      INSERT INTO word_submission_agents
        (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
      VALUES ('linked-agent', 'Linked', '', '["drawguess"]', 'active', 1000, 1000, 'now');
    `);
      const batch = database.prepare(`INSERT INTO word_submission_batches
      (id, agent_id, game, idempotency_key, request_hash, created_at)
      VALUES (?, 'linked-agent', 'drawguess', ?, 'hash', 'now')`);
      const item = database.prepare(`INSERT INTO word_submission_items
      (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status)
      VALUES (?, ?, 'drawguess', ?, ?, 'hash', '猫咪', 'animals', '{}', 'pending')`);
      const action = database.prepare(`INSERT INTO word_submission_actions
      (id, batch_id, action, request_hash, items_json, reason, status, created_at)
      VALUES (?, ?, 'approve', 'hash', '[]', 'retained', 'complete', 'now')`);
      const event = database.prepare(`INSERT INTO word_submission_events
      (action_id, item_id, action, actor, reason, created_at)
      VALUES (?, ?, 'approve', 'shared-admin', 'retained', 'now')`);
      for (let index = 0; index < count; index += 1) {
        batch.run(`batch-${index}`, `key-${index}`);
        item.run(`item-${index}`, `batch-${index}`, `client-${index}`, `identity-${index}`);
        action.run(`action-${index}`, `batch-${index}`);
        event.run(`action-${index}`, `item-${index}`);
      }
      database.exec(
        `UPDATE sqlite_sequence SET seq = ${count + 500} WHERE name = 'word_submission_events'`,
      );
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(
        database.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_next'").all(),
      ).toEqual([]);
      expect(
        database
          .prepare(
            `SELECT pending_count FROM word_submission_agents
      WHERE id = 'linked-agent'`,
          )
          .get(),
      ).toEqual({ pending_count: count });
      database.exec(`INSERT INTO word_submission_events
      (action_id, item_id, action, actor, reason, created_at)
      VALUES ('action-0', 'item-0', 'approve', 'shared-admin', 'after setup', 'now')`);
      expect(database.prepare('SELECT MAX(id) AS id FROM word_submission_events').get()).toEqual({
        id: count + 501,
      });
      database.exec("UPDATE word_submission_items SET status = 'passed' WHERE id = 'item-0'");
      expect(
        database
          .prepare('SELECT awaiting_publication_count AS count FROM word_submission_limits')
          .get(),
      ).toEqual({ count: 1 });
      database.exec("UPDATE word_submission_items SET status = 'published' WHERE id = 'item-0'");
      expect(
        database
          .prepare(
            'SELECT pending_count AS count, published_count AS published FROM word_submission_limits',
          )
          .get(),
      ).toEqual({
        count: count - 1,
        published: 1,
      });
      expect(
        database
          .prepare(
            `SELECT pending_count FROM word_submission_agents
      WHERE id = 'linked-agent'`,
          )
          .get(),
      ).toEqual({ pending_count: count - 1 });
      expect(() =>
        database.exec(`INSERT INTO word_submission_events
      (action_id, action, actor, reason, created_at)
      VALUES ('missing-action', 'approve', 'shared-admin', '', 'now')`),
      ).toThrow(/FOREIGN KEY/);
    } finally {
      database.close();
    }
  },
);

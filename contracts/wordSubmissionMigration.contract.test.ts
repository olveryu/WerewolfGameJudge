import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { DECRYPTO_WORD_CATEGORIES } from '@game-judge/game-engine/games/decrypto/public';
import { expect, it } from 'vitest';

const migrationsDirectory = 'packages/api-worker/migrations';

function applyMigrationsThrough(database: DatabaseSync, lastMigration: string): void {
  const names = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (!names.includes(lastMigration)) throw new Error(`Missing migration ${lastMigration}`);
  for (const name of names) {
    if (name > lastMigration) break;
    database.exec(readFileSync(`${migrationsDirectory}/${name}`, 'utf8'));
  }
}

function readSubmissionIndexes(database: DatabaseSync) {
  return database
    .prepare(
      `SELECT tables.name AS tableName,
        CASE indexes.origin WHEN 'c' THEN indexes.name ELSE indexes.origin END AS indexName,
        indexes."unique" AS isUnique, indexes.origin, indexes.partial,
        indexed_columns.seqno, indexed_columns.cid, indexed_columns.name AS columnName,
        indexed_columns."desc" AS descending, indexed_columns.coll, indexed_columns.key
      FROM sqlite_master AS tables
      JOIN pragma_index_list(tables.name) AS indexes
      JOIN pragma_index_xinfo(indexes.name) AS indexed_columns
      WHERE tables.type = 'table' AND tables.name IN (
        'word_submission_batches', 'word_submission_items', 'word_submission_actions',
        'word_submission_events')
      ORDER BY tableName, indexName, indexed_columns.seqno`,
    )
    .all();
}

it('preserves populated submission audit history, sequence, foreign keys and triggers when enabling authorization edits and deletion', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(
      readFileSync('packages/api-worker/migrations/0076_agent_word_submissions.sql', 'utf8'),
    );
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
    const history = database
      .prepare('SELECT * FROM word_submission_control_events ORDER BY id')
      .all();
    const triggers = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all();
    const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all();
    database.exec(
      readFileSync('packages/api-worker/migrations/0077_submission_agent_archive.sql', 'utf8'),
    );
    expect(
      database.prepare('SELECT * FROM word_submission_control_events ORDER BY id').all(),
    ).toEqual(history);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all()).toEqual(
      expect.arrayContaining(triggers),
    );
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()).toEqual(
      expect.arrayContaining(indexes),
    );
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

it.each([1, 1000])('preserves %i linked editorial records with one copy per table', (count) => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    applyMigrationsThrough(database, '0091_decrypto.sql');
    database.exec(`
      INSERT INTO word_submission_agents
        (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
      VALUES ('migration-agent', 'Migration', '', '["drawguess"]', 'active', 1000, 1000, 'now');
    `);
    const batch = database.prepare(`INSERT INTO word_submission_batches
      (id, agent_id, game, idempotency_key, request_hash, created_at)
      VALUES (?, 'migration-agent', 'drawguess', ?, 'hash', 'now')`);
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
    const tables = [
      'word_submission_batches',
      'word_submission_items',
      'word_submission_actions',
      'word_submission_events',
      'word_submission_limits',
    ];
    const before = tables.map((table) =>
      database.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
    );
    const indexes = readSubmissionIndexes(database);
    const changesBefore = database.prepare('SELECT total_changes() AS count').get();
    if (changesBefore === undefined || typeof changesBefore.count !== 'number')
      throw new Error('Missing SQLite write count before migration');
    database.exec('BEGIN');
    database.exec(readFileSync(`${migrationsDirectory}/0092_decrypto_word_supply.sql`, 'utf8'));
    database.exec('COMMIT');
    const changesAfter = database.prepare('SELECT total_changes() AS count').get();
    if (changesAfter === undefined || typeof changesAfter.count !== 'number')
      throw new Error('Missing SQLite write count after migration');
    // Four graph rows per fixture plus bounded agent/audit/sequence bookkeeping.
    // Index writes are additional D1 costs, not measured by SQLite total_changes().
    expect(changesAfter.count - changesBefore.count).toBeLessThanOrEqual(4 * count + 10);
    expect(
      tables.map((table) => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()),
    ).toEqual(before);
    expect(readSubmissionIndexes(database)).toEqual(indexes);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_next'").all(),
    ).toEqual([]);
    expect(
      database
        .prepare(
          `SELECT pending_count FROM word_submission_agents
      WHERE id = 'migration-agent'`,
        )
        .get(),
    ).toEqual({ pending_count: count });
    database.exec(`INSERT INTO word_submission_events
      (action_id, item_id, action, actor, reason, created_at)
      VALUES ('action-0', 'item-0', 'approve', 'shared-admin', 'after migration', 'now')`);
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
      WHERE id = 'migration-agent'`,
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
});

it('accepts all 40 canonical inventory categories and rejects unregistered categories in both tables', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    applyMigrationsThrough(database, '0092_decrypto_word_supply.sql');
    const word =
      database.prepare(`INSERT INTO decrypto_words (id, word, category, status, created_at)
      VALUES (?, ?, ?, 'active', 'now')`);
    const pack = database.prepare(`INSERT INTO decrypto_word_packs
      (id, category, request_token, status, model, prompt_version, review_version, created_at)
      VALUES (?, ?, 'request', 'reserved', 'model', 'prompt', 'review', 'now')`);
    expect(DECRYPTO_WORD_CATEGORIES).toHaveLength(40);
    for (const [index, category] of DECRYPTO_WORD_CATEGORIES.entries()) {
      word.run(`category-${category}`, `分类词${index}`, category);
      pack.run(`pack-${category}`, category);
    }
    for (const invalid of ['general', 'unknown']) {
      expect(() => word.run(`invalid-${invalid}`, `无效词${invalid}`, invalid)).toThrow(/CHECK/);
      expect(() => pack.run(`invalid-${invalid}`, invalid)).toThrow(/CHECK/);
    }
  } finally {
    database.close();
  }
});

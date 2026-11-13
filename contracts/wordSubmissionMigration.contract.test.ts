import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { expect, it } from 'vitest';

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

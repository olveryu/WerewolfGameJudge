/** Scheduled task isolation and strict cron dispatch contracts. */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { runScheduledCron } from '../runScheduledMaintenance';

const NOW_MS = Date.parse('2026-07-10T12:00:00.000Z');

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare('DELETE FROM login_attempts').run();
});

describe('runScheduledCron', () => {
  it('runs later daily cleanup tasks even when room reconciliation fails', async () => {
    await env.DB.prepare(
      `INSERT INTO rooms (
        id, code, game_type, host_user_id, creation_id, config_json, status,
        reconcile_after, created_at, updated_at, games_started
      ) VALUES ('not-a-durable-object-id', '8765', 'werewolf', 'host-1',
        'corrupt-reconciliation-row', '{}', 'creating',
        '2026-07-10T11:00:00.000Z', '2026-07-10T11:00:00.000Z',
        '2026-07-10T11:00:00.000Z', 0)`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO login_attempts (id, email_hash, attempted_at)
      VALUES ('old-login-attempt', 'hash', '2000-01-01T00:00:00.000Z')`,
    ).run();

    await expect(runScheduledCron(env, '0 3 * * *', NOW_MS)).rejects.toThrow(
      'daily cleanup tasks failed',
    );
    expect(
      await env.DB.prepare("SELECT id FROM login_attempts WHERE id = 'old-login-attempt'").first(),
    ).toBeNull();
  });

  it('rejects a cron expression that is not configured', async () => {
    await expect(runScheduledCron(env, '1 2 3 4 5', NOW_MS)).rejects.toThrow(
      'Unknown cron trigger: 1 2 3 4 5',
    );
  });
});

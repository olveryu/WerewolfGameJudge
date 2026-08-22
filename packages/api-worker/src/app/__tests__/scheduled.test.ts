/** Scheduled task isolation and strict cron dispatch contracts. */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { runScheduledCron } from '../scheduled';

const NOW_MS = Date.parse('2026-07-10T12:00:00.000Z');

beforeEach(async () => {
  await env.DB.prepare(
    `UPDATE fib_word_supply_state
     SET active_cycle_id = NULL, active_cycle_started_at = NULL, lease_owner = NULL,
         lease_expires_at = NULL, last_completed_at = NULL,
         updated_at = '1970-01-01T00:00:00.000Z'
     WHERE id = 1`,
  ).run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare('DELETE FROM login_attempts').run();
  await env.DB.prepare(
    "DELETE FROM users WHERE id IN ('stale-anonymous', 'room-host', 'refresh-owner')",
  ).run();
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

  it('dispatches the Fib word supply cron without generating during cadence cooldown', async () => {
    const now = new Date(NOW_MS).toISOString();
    await env.DB.prepare(
      `UPDATE fib_word_supply_state SET last_completed_at = ?, updated_at = ? WHERE id = 1`,
    )
      .bind(now, now)
      .run();

    await expect(runScheduledCron(env, '0 4 * * *', NOW_MS)).resolves.toBeUndefined();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_generation_cycles').first(),
    ).toEqual({ count: 0 });
  });

  it('deletes stale anonymous non-hosts and preserves room hosts', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, is_anonymous, created_at, updated_at) VALUES
        ('stale-anonymous', 1, '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z'),
        ('room-host', 1, '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO rooms (
        id, code, game_type, host_user_id, creation_id, config_json, status,
        created_at, updated_at, games_started
      ) VALUES ('active-room-id', '8766', 'werewolf', 'room-host',
        'active-room-creation', '{}', 'active',
        '2026-07-10T12:00:00.000Z', '2026-07-10T12:00:00.000Z', 0)`,
    ).run();

    await runScheduledCron(env, '0 3 * * *', NOW_MS);

    expect(
      await env.DB.prepare("SELECT id FROM users WHERE id = 'stale-anonymous'").first(),
    ).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM users WHERE id = 'room-host'").first()).toEqual({
      id: 'room-host',
    });
  });

  it('deletes expired refresh-token families and preserves active families', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, is_anonymous, created_at, updated_at)
       VALUES ('refresh-owner', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES
        ('expired-family', 'refresh-owner', 'expired-current-hash',
         '2026-07-10T12:00:00.000Z', '2026-07-01T00:00:00.000Z'),
        ('active-family', 'refresh-owner', 'active-current-hash',
         '2026-07-11T12:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO refresh_token_rotations
        (token_hash, refresh_token_id, successor_token_hash, rotated_at)
       VALUES ('expired-ancestor-hash', 'expired-family', 'expired-current-hash',
         '2026-07-10T11:59:00.000Z')`,
    ).run();

    await runScheduledCron(env, '0 3 * * *', NOW_MS);

    expect(await env.DB.prepare('SELECT id FROM refresh_tokens ORDER BY id').all()).toMatchObject({
      results: [{ id: 'active-family' }],
    });
    expect(
      await env.DB.prepare(
        "SELECT token_hash FROM refresh_token_rotations WHERE token_hash = 'expired-ancestor-hash'",
      ).first(),
    ).toBeNull();
  });
});

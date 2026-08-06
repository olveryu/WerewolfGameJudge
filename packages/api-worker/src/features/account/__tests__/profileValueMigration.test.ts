/** Integration contract for optional profile value normalization. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0042_normalize_optional_profile_values.sql';
const INSERT_TRIGGER = 'users_optional_profile_values_insert';
const UPDATE_TRIGGER = 'users_optional_profile_values_update';

function requireMigration() {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined || migration.queries.length === 0) {
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  }
  return migration;
}

async function dropProfileValueTriggers(): Promise<void> {
  await env.DB.exec(`
    DROP TRIGGER IF EXISTS ${INSERT_TRIGGER};
    DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER};
  `);
}

async function applyProfileValueMigration(): Promise<void> {
  const migration = requireMigration();
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
}

describe(MIGRATION_NAME, () => {
  it('normalizes historical empty values and rejects future empty writes', async () => {
    await dropProfileValueTriggers();
    await env.DB.prepare(
      `INSERT INTO users (
        id,
        avatar_url,
        custom_avatar_url,
        avatar_frame,
        equipped_flair,
        equipped_name_style,
        equipped_effect,
        equipped_seat_animation,
        is_anonymous,
        created_at,
        updated_at
      ) VALUES (?, '', '', '', '', '', '', '', 1, datetime('now'), datetime('now'))`,
    )
      .bind('legacy-empty-profile')
      .run();

    await applyProfileValueMigration();

    const row = await env.DB.prepare(
      `SELECT
        avatar_url,
        custom_avatar_url,
        avatar_frame,
        equipped_flair,
        equipped_name_style,
        equipped_effect,
        equipped_seat_animation
      FROM users
      WHERE id = ?`,
    )
      .bind('legacy-empty-profile')
      .first();
    expect(row).toEqual({
      avatar_url: null,
      custom_avatar_url: null,
      avatar_frame: null,
      equipped_flair: null,
      equipped_name_style: null,
      equipped_effect: null,
      equipped_seat_animation: null,
    });

    await expect(
      env.DB.prepare(`UPDATE users SET avatar_url = '' WHERE id = ?`)
        .bind('legacy-empty-profile')
        .run(),
    ).rejects.toThrow('optional profile values must be null or non-empty');
    await expect(
      env.DB.prepare(
        `INSERT INTO users (
          id, equipped_effect, is_anonymous, created_at, updated_at
        ) VALUES (?, '', 1, datetime('now'), datetime('now'))`,
      )
        .bind('new-empty-profile')
        .run(),
    ).rejects.toThrow('optional profile values must be null or non-empty');
  });
});

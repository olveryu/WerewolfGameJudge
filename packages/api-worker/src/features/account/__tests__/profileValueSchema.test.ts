/** Current-schema contract for optional profile values (triggers introduced by 0042): empty
 * strings are rejected on insert and update. Runs on the full migration chain applied by
 * test/applyMigrations.ts. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('optional profile value triggers', () => {
  it('rejects empty profile values on insert and update', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, is_anonymous, created_at, updated_at)
       VALUES (?, 1, datetime('now'), datetime('now'))`,
    )
      .bind('null-profile')
      .run();

    await expect(
      env.DB.prepare(`UPDATE users SET avatar_url = '' WHERE id = ?`).bind('null-profile').run(),
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

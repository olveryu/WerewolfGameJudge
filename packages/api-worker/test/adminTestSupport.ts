/**
 * Shared admin auth helper for worker integration tests.
 *
 * The admin portal authenticates via the app JWT system. This helper provisions
 * the super-admin principal from the ADMIN_USER_IDS allowlist
 * ("test-super-admin" in wrangler.test.toml) and returns Bearer headers.
 */
import { env } from 'cloudflare:test';

import { issueTokenPair } from '../src/features/auth/tokenAuth';

/** Super-admin user id from ADMIN_USER_IDS in wrangler.test.toml. */
export const TEST_SUPER_ADMIN_ID = 'test-super-admin';

export interface AdminTestSession {
  userId: string;
  headers: Record<string, string>;
}

/**
 * Ensures the super-admin user row exists and issues a real JWT for it.
 * The row keeps is_admin=0 so tests also prove the env allowlist path works.
 */
export async function createSuperAdminSession(): Promise<AdminTestSession> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users
       (id, display_name, is_anonymous, is_admin, token_version, created_at, updated_at)
     VALUES (?, 'TestSuperAdmin', 0, 0, 0, datetime('now'), datetime('now'))`,
  )
    .bind(TEST_SUPER_ADMIN_ID)
    .run();
  const pair = await issueTokenPair(TEST_SUPER_ADMIN_ID, env, 0);
  return {
    userId: TEST_SUPER_ADMIN_ID,
    headers: { Authorization: `Bearer ${pair.access_token}` },
  };
}

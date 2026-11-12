/** Shared email-keyed failure budget for password authentication entry points. */

import { sha256Hex } from '../../platform/crypto/sha256Hex';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

/** The caller supplies the normalized email used for account lookup. */
export async function readPasswordAttemptBudget(db: D1Database, email: string) {
  const emailHash = await sha256Hex(email);
  const recentAttempts = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM login_attempts
       WHERE email_hash = ? AND attempted_at > datetime('now', ? || ' minutes')`,
    )
    .bind(emailHash, -WINDOW_MINUTES)
    .first<{ count: number }>();

  return { emailHash, isLimited: recentAttempts !== null && recentAttempts.count >= MAX_ATTEMPTS };
}

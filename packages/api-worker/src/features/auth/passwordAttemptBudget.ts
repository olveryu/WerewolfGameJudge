/** Shared email-keyed attempt budget for password authentication entry points. */

import { sha256Hex } from '../../platform/crypto/sha256Hex';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

/** Atomically reserves an attempt when the email has not reached its limit. */
export async function reservePasswordAttemptBudget(db: D1Database, email: string) {
  const emailHash = await sha256Hex(email);
  const reservation = await db
    .prepare(
      `INSERT INTO login_attempts (email_hash, attempted_at)
       SELECT ?, datetime('now')
       WHERE (
         SELECT COUNT(*) FROM login_attempts
         WHERE email_hash = ? AND attempted_at > datetime('now', ? || ' minutes')
       ) < ?
       RETURNING id`,
    )
    .bind(emailHash, emailHash, -WINDOW_MINUTES, MAX_ATTEMPTS)
    .first<{ id: string }>();

  return { emailHash, isLimited: reservation === null };
}

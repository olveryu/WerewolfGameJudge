/**
 * Password Hashing — dual-algorithm verification (PBKDF2 + bcrypt)
 *
 * Newly registered users use PBKDF2-SHA256 (CF Workers native Web Crypto API).
 * Users migrated from Supabase Auth keep their bcrypt hash; on first successful login
 * they are automatically rehashed to PBKDF2 (lazy migration).
 */

import { compare } from 'bcryptjs';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/** Password verification result, carries a rehash signal for the caller to update DB */
interface VerifyResult {
  valid: boolean;
  /** If true, caller should write newHash back to DB to replace the old bcrypt hash */
  needsRehash: boolean;
  /** Only set when needsRehash=true — new hash in PBKDF2 format */
  newHash?: string;
}

/** Detect whether the hash is in bcrypt format ($2a$ / $2b$ / $2y$) */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/** Generate PBKDF2 hash, returns `$pbkdf2-sha256$iterations$salt$hash` format */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: ITERATIONS,
    },
    key,
    HASH_BYTES * 8,
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return `$pbkdf2-sha256$${ITERATIONS}$${saltB64}$${hashB64}`;
}

/**
 * Verify password, supports both PBKDF2 and bcrypt formats.
 * On successful bcrypt verification, marks needsRehash for the caller to complete lazy migration.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<VerifyResult> {
  // ── bcrypt (migrated from Supabase Auth) ─────────────────────────────────
  if (isBcryptHash(storedHash)) {
    const valid = await compare(password, storedHash);
    if (!valid) return { valid: false, needsRehash: false };
    // Rehash to PBKDF2 for future logins
    const newHash = await hashPassword(password);
    return { valid: true, needsRehash: true, newHash };
  }

  // ── PBKDF2-SHA256 (native) ──────────────────────────────────────────────
  const parts = storedHash.split('$');
  // Format: $pbkdf2-sha256$iterations$salt$hash
  if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
    return { valid: false, needsRehash: false };
  }

  const iterations = parseInt(parts[2], 10);
  const salt = Uint8Array.from(atob(parts[3]), (c) => c.charCodeAt(0));
  const expectedHash = parts[4];

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    HASH_BYTES * 8,
  );
  const computedHash = btoa(String.fromCharCode(...new Uint8Array(derived)));

  // Constant-time comparison to prevent timing attacks
  if (expectedHash.length !== computedHash.length) {
    return { valid: false, needsRehash: false };
  }
  let mismatch = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    mismatch |= expectedHash.charCodeAt(i) ^ computedHash.charCodeAt(i);
  }
  return { valid: mismatch === 0, needsRehash: false };
}

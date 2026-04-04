/**
 * Password Hashing — 双算法验证 (PBKDF2 + bcrypt)
 *
 * 新注册用户使用 PBKDF2-SHA256（CF Workers 原生 Web Crypto API）。
 * 从 Supabase Auth 迁移的用户保留 bcrypt hash，首次登录验证成功后
 * 自动 rehash 为 PBKDF2（lazy migration）。
 */

import { compare } from 'bcryptjs';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/** 密码验证结果，携带 rehash 信号供调用方更新 DB */
export interface VerifyResult {
  valid: boolean;
  /** 如果为 true，调用方应将 newHash 写回 DB 替换旧的 bcrypt hash */
  needsRehash: boolean;
  /** 仅当 needsRehash=true 时有值 — PBKDF2 格式的新 hash */
  newHash?: string;
}

/** 检测是否为 bcrypt 格式 hash（$2a$ / $2b$ / $2y$） */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/** 生成 PBKDF2 hash，返回 `$pbkdf2-sha256$iterations$salt$hash` 格式 */
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
 * 验证密码，支持 PBKDF2 和 bcrypt 两种格式。
 * bcrypt 验证成功时标记 needsRehash，由调用方完成 lazy migration。
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

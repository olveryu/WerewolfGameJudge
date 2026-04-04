/**
 * Password Hashing — Web Crypto API (PBKDF2)
 *
 * 使用 PBKDF2-SHA256 做密码哈希，CF Workers 运行时原生支持。
 * 不需要 bcrypt/scrypt 等 WASM 依赖。
 */

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

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

/** 验证密码是否匹配存储的 hash */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  // Format: $pbkdf2-sha256$iterations$salt$hash
  if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') return false;

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
  if (expectedHash.length !== computedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    mismatch |= expectedHash.charCodeAt(i) ^ computedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

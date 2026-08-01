/**
 * id - Platform-agnostic unique ID generation for game-engine
 *
 * Uses the standard Web Crypto API (Node 19+ / all modern browsers natively).
 * No dependency on expo-crypto. Exports randomHex and request IDs.
 * Does not use Math.random(); no platform imports.
 */

/**
 * Generate a random hexadecimal string
 * Uses the Web Crypto API (Node 19+ / native browser support)
 */
export function randomHex(length: number): string {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error(`[FAIL-FAST] Random hexadecimal length must be a positive integer: ${length}`);
  }
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Generate a unique Request ID (for RPC/ACK correlation)
 */
export function newRequestId(): string {
  if (typeof crypto.randomUUID !== 'function') {
    throw new Error('[FAIL-FAST] crypto.randomUUID is required to generate request IDs');
  }
  return crypto.randomUUID();
}

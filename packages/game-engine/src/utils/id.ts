/**
 * id - Platform-agnostic unique ID generation for game-engine
 *
 * Uses the standard Web Crypto API (Node 19+ / all modern browsers natively).
 * No dependency on expo-crypto. Exports randomHex / requestId / rejectionId.
 * Does not use Math.random(); no platform imports.
 */

/**
 * Generate a random hexadecimal string
 * Uses the Web Crypto API (Node 19+ / native browser support)
 */
export function randomHex(length: number): string {
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
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${randomHex(12)}`;
}

/**
 * Generate a unique Rejection ID (for action rejection deduplication)
 *
 * Format: `{timestamp}:{random}`
 */
export function newRejectionId(): string {
  return `${Date.now()}:${randomHex(8)}`;
}

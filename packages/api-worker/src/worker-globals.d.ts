/**
 * Worker globals supplementary declarations
 *
 * game-engine source accesses the Web Crypto API via globalThis.crypto.
 * @cloudflare/workers-types already declares a top-level crypto variable,
 * but ES2022 lib's globalThis does not include a crypto property.
 * This file supplements crypto on globalThis to eliminate type errors.
 */

interface Crypto {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
  readonly subtle: SubtleCrypto;
}

// Augment globalThis so `globalThis.crypto` resolves
declare let crypto: Crypto;

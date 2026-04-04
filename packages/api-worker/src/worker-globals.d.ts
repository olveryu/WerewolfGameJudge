/**
 * Worker globals supplementary declarations
 *
 * game-engine 源码通过 globalThis.crypto 访问 Web Crypto API。
 * @cloudflare/workers-types 已声明顶层 crypto 变量，
 * 但 ES2022 lib 的 globalThis 上不包含 crypto 属性。
 * 此文件在 globalThis 上补充 crypto 声明以消除类型错误。
 */

interface Crypto {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
  readonly subtle: SubtleCrypto;
}

// Augment globalThis so `globalThis.crypto` resolves
declare let crypto: Crypto;

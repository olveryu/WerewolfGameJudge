/**
 * random - Platform-agnostic secure random utilities for game-engine
 *
 * Uses standard Web Crypto API (natively supported by Node 19+ and all modern browsers).
 * Does not depend on expo-crypto. Exports secureRng / randomIntInclusive / randomBool / randomPick / Rng types.
 * Does not use Math.random(); no platform-dependent imports.
 */

/**
 * Random number generator type.
 * Returns a float in [0, 1).
 */
export type Rng = () => number;

/**
 * Secure random number generator.
 * Uses Web Crypto API (natively supported by Node 19+ / browsers).
 *
 * @returns Float in [0, 1)
 */
export function secureRng(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! / 0x100000000;
}

/**
 * Generate a random integer in the given range (inclusive on both ends).
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param rng - Optional Rng, defaults to secureRng
 * @returns Integer in [min, max]
 */
export function randomIntInclusive(min: number, max: number, rng: Rng = secureRng): number {
  const range = max - min + 1;
  return Math.floor(rng() * range) + min;
}

/**
 * Generate a random boolean.
 *
 * @param rng - Optional Rng, defaults to secureRng
 * @returns true or false
 */
export function randomBool(rng: Rng = secureRng): boolean {
  return rng() < 0.5;
}

/**
 * Pick a random element from an array.
 *
 * @param arr - Non-empty array
 * @param rng - Optional Rng, defaults to secureRng
 * @returns A random element from the array
 * @throws If the array is empty
 */
export function randomPick<T>(arr: readonly T[], rng: Rng = secureRng): T {
  if (arr.length === 0) {
    throw new Error('randomPick: array must not be empty');
  }
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * Create a deterministic PRNG from a string seed (mulberry32).
 *
 * All clients given the same seed produce identical sequences, enabling
 * coordinated randomness without server round-trips.
 *
 * @param seed - Arbitrary string used as seed
 * @returns A deterministic Rng function producing [0, 1) floats
 */
export function createSeededRng(seed: string): Rng {
  // Simple string -> 32-bit hash (djb2)
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  // mulberry32 PRNG
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * roomCode - Room code generation utilities
 *
 * Single entry point for room code generation — produces a 4-digit code and ensures all room-creation paths share the same logic.
 * Uses secure randomness throughout, reusing secureRng from random.ts.
 * No React or service dependencies. Math.random() and custom crypto fallbacks are forbidden.
 */

import { secureRng } from '@werewolf/game-engine/utils/random';

/**
 * Generate a 4-digit room code (1000–9999).
 *
 * Reuses secureRng (standard Web Crypto API).
 *
 * @returns 4-digit numeric string in the range 1000–9999
 */
export function generateRoomCode(): string {
  const range = 9000; // 9999 - 1000 + 1 = 9000 种可能
  const randomValue = Math.floor(secureRng() * range);
  return (1000 + randomValue).toString();
}

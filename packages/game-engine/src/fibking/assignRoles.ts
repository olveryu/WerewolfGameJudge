/**
 * assignFibRoles — deterministic-with-injected-RNG role assignment.
 *
 * Over the seated seats: exactly 1 guesser + 1 honest + the rest fibber.
 * Production passes secureRng; tests inject createSeededRng(seed) for exact assertions.
 */

import type { Rng } from '../utils/random';
import { shuffleArray } from '../utils/shuffle';
import type { FibRole } from './types';

export function assignFibRoles(seatedSeats: number[], rng: Rng): Record<number, FibRole> {
  if (seatedSeats.length < 3) {
    // Invariant: callers (START_ROUND) only run on a full table of N≥4. Violation = bug.
    throw new Error(`assignFibRoles: need ≥3 seats, got ${seatedSeats.length}`);
  }

  const shuffled = shuffleArray([...seatedSeats], rng);
  const roleBySeat: Record<number, FibRole> = {};
  roleBySeat[shuffled[0]!] = 'guesser';
  roleBySeat[shuffled[1]!] = 'honest';
  for (let i = 2; i < shuffled.length; i++) {
    roleBySeat[shuffled[i]!] = 'fibber';
  }
  return roleBySeat;
}

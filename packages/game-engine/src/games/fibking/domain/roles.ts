/** O(1) deterministic FibKing role assignment within the configured player range. */

import { createSeededRng, randomIntInclusive } from '../../../platform/random';
import {
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
  type FibRoleAssignment,
  isValidFibPlayerCount,
} from '../state/types';

export function assignFibRoles(numberOfPlayers: number, randomSeed: string): FibRoleAssignment {
  if (!isValidFibPlayerCount(numberOfPlayers)) {
    throw new Error(`Fib role assignment requires ${FIB_MIN_PLAYERS}-${FIB_MAX_PLAYERS} seats`);
  }
  if (randomSeed.length === 0) {
    throw new Error('Fib role assignment requires a non-empty random seed');
  }

  const rng = createSeededRng(`${randomSeed}:fib-roles`);
  const guesserSeat = randomIntInclusive(0, numberOfPlayers - 1, rng);
  const honestIndex = randomIntInclusive(0, numberOfPlayers - 2, rng);
  const honestSeat = honestIndex >= guesserSeat ? honestIndex + 1 : honestIndex;
  return { guesserSeat, honestSeat };
}

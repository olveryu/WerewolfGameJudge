/** O(1) deterministic FibKing role assignment within the configured player range. */

import {
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
  type FibRoleAssignment,
  isValidFibPlayerCount,
} from '../state/types';

const UINT64_RANGE = 1n << 64n;
const UINT64_MASK = UINT64_RANGE - 1n;
const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const SPLITMIX64_INCREMENT = 0x9e3779b97f4a7c15n;

type Uint64Rng = () => bigint;

function hashSeed64(seed: string): bigint {
  let hash = FNV64_OFFSET;
  for (const character of seed) {
    hash ^= BigInt(character.codePointAt(0)!);
    hash = (hash * FNV64_PRIME) & UINT64_MASK;
  }
  return hash;
}

function createSplitMix64(seed: string): Uint64Rng {
  let state = hashSeed64(seed);
  return () => {
    state = (state + SPLITMIX64_INCREMENT) & UINT64_MASK;
    let value = state;
    value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & UINT64_MASK;
    value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & UINT64_MASK;
    return (value ^ (value >> 31n)) & UINT64_MASK;
  };
}

function sampleSafeInteger(bound: number, rng: Uint64Rng): number {
  const bigintBound = BigInt(bound);
  const rejectionLimit = UINT64_RANGE - (UINT64_RANGE % bigintBound);
  for (;;) {
    const value = rng();
    if (value < rejectionLimit) return Number(value % bigintBound);
  }
}

export function assignFibRoles(numberOfPlayers: number, randomSeed: string): FibRoleAssignment {
  if (!isValidFibPlayerCount(numberOfPlayers)) {
    throw new Error(`Fib role assignment requires ${FIB_MIN_PLAYERS}-${FIB_MAX_PLAYERS} seats`);
  }
  if (randomSeed.length === 0) {
    throw new Error('Fib role assignment requires a non-empty random seed');
  }

  const rng = createSplitMix64(`${randomSeed}:fib-roles`);
  const guesserSeat = sampleSafeInteger(numberOfPlayers, rng);
  const honestIndex = sampleSafeInteger(numberOfPlayers - 1, rng);
  const honestSeat = honestIndex >= guesserSeat ? honestIndex + 1 : honestIndex;
  return { guesserSeat, honestSeat };
}

/** Ordinal-list codec and candidate picking for the shared word draw; pure, no I/O. */

import { randomIntInclusive, type Rng } from '@game-judge/game-engine/platform/random';

/**
 * How a draw treats words a participant has already seen.
 *
 * - `excludeSeen`: only words no participant has seen can be drawn.
 * - `preferUnseen`: unseen words first, then seen ones fill the remaining count.
 */
export type WordSeenPolicy = 'excludeSeen' | 'preferUnseen';

/** The ordinals one account has seen: single ordinals plus inclusive ranges. */
export interface SeenOrdinals {
  readonly singles: ReadonlySet<number>;
  readonly ranges: readonly (readonly [number, number])[];
}

const SINGLE_TOKEN = /^\d+$/;
const RANGE_TOKEN = /^(\d+)-(\d+)$/;

function splitOrdinalTokens(encoded: string, label: string): readonly string[] {
  if (!encoded.startsWith(',') || !encoded.endsWith(',')) {
    throw new Error(`[FAIL-FAST] ${label} ordinal list must start and end with a comma`);
  }
  return encoded.split(',').filter((token) => token.length > 0);
}

function parseOrdinal(token: string, label: string): number {
  const ordinal = Number(token);
  if (!Number.isSafeInteger(ordinal) || ordinal <= 0) {
    throw new Error(`[FAIL-FAST] ${label} ordinal list holds an invalid ordinal: ${token}`);
  }
  return ordinal;
}

/** Decode a `word_draw_index.members` value (",3,17,42,") into distinct ordinals. */
export function decodeDrawMembers(encoded: string): readonly number[] {
  const members = new Set<number>();
  for (const token of splitOrdinalTokens(encoded, 'Draw index')) {
    if (!SINGLE_TOKEN.test(token)) {
      throw new Error(`[FAIL-FAST] Draw index ordinal list holds an invalid token: ${token}`);
    }
    members.add(parseOrdinal(token, 'Draw index'));
  }
  return [...members];
}

/** Decode a `word_seen.seen` value (",1-250,263,") into single ordinals and ranges. */
export function decodeSeenOrdinals(encoded: string): SeenOrdinals {
  const singles = new Set<number>();
  const ranges: (readonly [number, number])[] = [];
  for (const token of splitOrdinalTokens(encoded, 'Seen')) {
    const range = RANGE_TOKEN.exec(token);
    if (range !== null) {
      const first = parseOrdinal(range[1] ?? '', 'Seen');
      const last = parseOrdinal(range[2] ?? '', 'Seen');
      if (first > last) {
        throw new Error(`[FAIL-FAST] Seen ordinal list holds an inverted range: ${token}`);
      }
      ranges.push([first, last]);
      continue;
    }
    if (!SINGLE_TOKEN.test(token)) {
      throw new Error(`[FAIL-FAST] Seen ordinal list holds an invalid token: ${token}`);
    }
    singles.add(parseOrdinal(token, 'Seen'));
  }
  return { singles, ranges };
}

function hasSeen(seen: SeenOrdinals, ordinal: number): boolean {
  if (seen.singles.has(ordinal)) return true;
  return seen.ranges.some(([first, last]) => ordinal >= first && ordinal <= last);
}

/** Move `count` uniformly random elements to the front of `pool` and return them. */
function takeRandom(pool: number[], count: number, rng: Rng): number[] {
  const taken = Math.min(count, pool.length);
  for (let index = 0; index < taken; index += 1) {
    const swapIndex = randomIntInclusive(index, pool.length - 1, rng);
    const current = pool[index];
    const swapped = pool[swapIndex];
    if (current === undefined || swapped === undefined) {
      throw new Error('[FAIL-FAST] Word draw candidate index out of range');
    }
    pool[index] = swapped;
    pool[swapIndex] = current;
  }
  return pool.slice(0, taken);
}

export interface PickDrawOrdinalsInput {
  /** Drawable ordinals of the pool partition. */
  readonly members: readonly number[];
  /** One entry per participant that has a seen record. */
  readonly seenByParticipant: readonly SeenOrdinals[];
  /** Ordinals already picked or rejected in this draw. */
  readonly excluded: ReadonlySet<number>;
  readonly count: number;
  readonly seenPolicy: WordSeenPolicy;
  readonly rng: Rng;
}

/**
 * Pick up to `count` ordinals uniformly at random. A word counts as seen when
 * any participant has seen it; under `preferUnseen`, seen words are used only
 * after the unseen ones run out.
 */
export function pickDrawOrdinals(input: PickDrawOrdinalsInput): readonly number[] {
  const unseen: number[] = [];
  const seen: number[] = [];
  for (const ordinal of input.members) {
    if (input.excluded.has(ordinal)) continue;
    const isSeen = input.seenByParticipant.some((participant) => hasSeen(participant, ordinal));
    (isSeen ? seen : unseen).push(ordinal);
  }
  const picked = takeRandom(unseen, input.count, input.rng);
  if (input.seenPolicy === 'preferUnseen' && picked.length < input.count) {
    picked.push(...takeRandom(seen, input.count - picked.length, input.rng));
  }
  return picked;
}

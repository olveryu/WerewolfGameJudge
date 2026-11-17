import { createSeededRng, shuffleArray } from '../../../platform/random';

/** PG(2,7): affine lines, vertical lines, and the line at infinity. */
export const SPOTMATCH_CARD_TYPES: readonly (readonly number[])[] = [
  ...Array.from({ length: 7 }, (_, slope) =>
    Array.from({ length: 7 }, (_, intercept) => [
      ...Array.from({ length: 7 }, (_, x) => x * 7 + ((slope * x + intercept) % 7)),
      49 + slope,
    ]),
  ).flat(),
  ...Array.from({ length: 7 }, (_, x) => [...Array.from({ length: 7 }, (_, y) => x * 7 + y), 56]),
  Array.from({ length: 8 }, (_, index) => 49 + index),
];

export interface SpotmatchCard {
  readonly instanceId: string;
  readonly typeId: number;
  readonly layoutSeed: number;
  readonly symbols: readonly number[];
}

export function chooseSpotmatchSymbols(seed: string): readonly number[] {
  return shuffleArray(
    Array.from({ length: 200 }, (_, index) => index),
    createSeededRng(seed),
  ).slice(0, 57);
}

export function createSpotmatchCard(
  roundId: string,
  serial: number,
  excluded: readonly number[],
  symbolMap: readonly number[],
  seed: string,
): SpotmatchCard {
  const rng = createSeededRng(seed);
  const candidates = SPOTMATCH_CARD_TYPES.map((_, index) => index).filter(
    (typeId) => !excluded.includes(typeId),
  );
  const typeId = candidates[Math.floor(rng() * candidates.length)];
  if (typeId === undefined) throw new Error('Spotmatch exhausted visible card types');
  const points = SPOTMATCH_CARD_TYPES[typeId];
  if (points === undefined) throw new Error('Unknown Spotmatch card type');
  return {
    instanceId: `${roundId}:card:${serial}`,
    typeId,
    layoutSeed: Math.floor(rng() * 0x7fffffff),
    symbols: points.map((point) => {
      const symbol = symbolMap[point];
      if (symbol === undefined) throw new Error('Incomplete Spotmatch symbol map');
      return symbol;
    }),
  };
}

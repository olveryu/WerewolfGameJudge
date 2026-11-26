/**
 * P2 contract: all three games export the word publication two pieces
 * (reserve / fail) from their wordPublication module, each piece matching
 * the shared WordSupplyPublication interface. Supply only generates and
 * stores the words as pending submission items: review and publication
 * live on the submission flow, so the runner needs nothing else from a
 * game. There is no candidate-store piece and no reserve opts: one trigger
 * runs one pack, identified by the run id.
 *
 * The satisfies blocks pin runner compatibility: a missing piece, an extra
 * required parameter, or a piece moved to another module fails typecheck.
 * The Exact pins cover each piece, so any further signature drift also
 * fails typecheck. Pins are typed assignments (`const pin: Exact<...> = true`),
 * never `as` assertions: `true as false` typechecks, so an assertion-form
 * pin would silently hold nothing.
 */
import type { DrawGuessWordCategory } from '@game-judge/game-engine/games/drawguess/public';
import type { FibWordSupplyCategory } from '@game-judge/game-engine/games/fibking/public';
import type { UndercoverCategory } from '@game-judge/game-engine/games/undercover/public';
import { describe, expect, it } from 'vitest';

import {
  type DrawGuessWordPack,
  failDrawGuessWordPack,
  reserveDrawGuessWordPack,
} from '../../../games/drawguess/wordPublication';
import {
  failFibWordPack,
  type FibWordPack,
  reserveFibWordPack,
} from '../../../games/fibking/wordPublication';
import {
  failUndercoverWordPack,
  reserveUndercoverWordPack,
  type UndercoverWordPack,
} from '../../../games/undercover/wordPublication';
import type { WordSupplyPublication } from '../wordSupplyWorkflow';

/** Strict type identity (mutual conditional identity), not just assignability. */
type Exact<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;

type UndercoverPublication = WordSupplyPublication<UndercoverCategory, UndercoverWordPack>;
type DrawGuessPublication = WordSupplyPublication<DrawGuessWordCategory, DrawGuessWordPack>;
type FibPublication = WordSupplyPublication<FibWordSupplyCategory, FibWordPack>;

const undercoverPublication = {
  reserve: reserveUndercoverWordPack,
  fail: failUndercoverWordPack,
} satisfies UndercoverPublication;

const drawGuessPublication = {
  reserve: reserveDrawGuessWordPack,
  fail: failDrawGuessWordPack,
} satisfies DrawGuessPublication;

const fibPublication = {
  reserve: reserveFibWordPack,
  fail: failFibWordPack,
} satisfies FibPublication;

const undercoverReservePin: Exact<
  typeof reserveUndercoverWordPack,
  (
    db: D1Database,
    day: string,
    runId: string,
    category: UndercoverCategory,
  ) => Promise<UndercoverWordPack | null>
> = true;
const undercoverFailPin: Exact<typeof failUndercoverWordPack, UndercoverPublication['fail']> = true;
const drawGuessReservePin: Exact<
  typeof reserveDrawGuessWordPack,
  (
    db: D1Database,
    day: string,
    runId: string,
    category: DrawGuessWordCategory,
  ) => Promise<DrawGuessWordPack | null>
> = true;
const drawGuessFailPin: Exact<typeof failDrawGuessWordPack, DrawGuessPublication['fail']> = true;
const fibReservePin: Exact<
  typeof reserveFibWordPack,
  (
    db: D1Database,
    day: string,
    runId: string,
    category: FibWordSupplyCategory,
  ) => Promise<FibWordPack | null>
> = true;
const fibFailPin: Exact<typeof failFibWordPack, FibPublication['fail']> = true;

const typePins = [
  undercoverReservePin,
  undercoverFailPin,
  drawGuessReservePin,
  drawGuessFailPin,
  fibReservePin,
  fibFailPin,
];

describe('word publication two-piece contract (P2)', () => {
  it('pins every piece of all three publications to the shared interface', () => {
    expect(typePins).toEqual(Array(typePins.length).fill(true));
  });

  it('exposes exactly the two publication pieces per game', () => {
    for (const publication of [undercoverPublication, drawGuessPublication, fibPublication]) {
      expect(Object.keys(publication).sort()).toEqual(['fail', 'reserve']);
      for (const piece of Object.values(publication)) expect(typeof piece).toBe('function');
    }
  });
});

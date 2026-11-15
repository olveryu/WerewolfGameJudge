/**
 * P2 contract: all three games export the word publication three pieces
 * (reserve / storeCandidates / fail) from their wordPublication module, each
 * piece matching the shared WordSupplyPublication interface. Supply only
 * generates: review and publication live on the manual review/publish
 * endpoints, so the runner needs nothing else from a game.
 *
 * The satisfies blocks pin runner compatibility: a missing piece, an extra
 * required parameter, or a piece moved to another module fails typecheck.
 * The Exact pins cover the sanctioned fibking deviation — reserve carries
 * batchLimit inside its opts — plus the plain pieces of all three games
 * and the opts key sets, so any further signature drift also fails
 * typecheck. Pins are typed assignments (`const pin: Exact<...> = true`),
 * never `as` assertions: `true as false` typechecks, so an assertion-form
 * pin would silently hold nothing.
 */
import { describe, expect, it } from 'vitest';

import type { DrawGuessWordCandidate } from '../../../games/drawguess/wordEditorial';
import {
  type DrawGuessWordPack,
  failDrawGuessWordPack,
  reserveDrawGuessWordPack,
  storeDrawGuessWordCandidates,
} from '../../../games/drawguess/wordPublication';
import type { FibWordEditorialCandidate } from '../../../games/fibking/wordProviders/types';
import {
  failFibWordPack,
  type FibWordPack,
  reserveFibWordPack,
  storeFibWordCandidates,
} from '../../../games/fibking/wordPublication';
import type { UndercoverWordCandidate } from '../../../games/undercover/wordEditorial';
import {
  failUndercoverWordPack,
  reserveUndercoverWordPack,
  storeUndercoverWordCandidates,
  type UndercoverWordPack,
} from '../../../games/undercover/wordPublication';
import type { WordSupplyPublication } from '../wordSupplyWorkflow';

/** Strict type identity (mutual conditional identity), not just assignability. */
type Exact<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;

type UndercoverPublication = WordSupplyPublication<UndercoverWordPack, UndercoverWordCandidate>;
type DrawGuessPublication = WordSupplyPublication<DrawGuessWordPack, DrawGuessWordCandidate>;
type FibPublication = WordSupplyPublication<FibWordPack, FibWordEditorialCandidate>;

const undercoverPublication = {
  reserve: reserveUndercoverWordPack,
  storeCandidates: storeUndercoverWordCandidates,
  fail: failUndercoverWordPack,
} satisfies UndercoverPublication;

const drawGuessPublication = {
  reserve: reserveDrawGuessWordPack,
  storeCandidates: storeDrawGuessWordCandidates,
  fail: failDrawGuessWordPack,
} satisfies DrawGuessPublication;

const fibPublication = {
  reserve: reserveFibWordPack,
  storeCandidates: storeFibWordCandidates,
  fail: failFibWordPack,
} satisfies FibPublication;

type ReserveOpts = { force?: boolean; runId?: string };

const undercoverReservePin: Exact<
  typeof reserveUndercoverWordPack,
  (
    db: D1Database,
    day: string,
    batchIndex: number,
    opts?: ReserveOpts,
  ) => Promise<UndercoverWordPack | null>
> = true;
const undercoverStoreCandidatesPin: Exact<
  typeof storeUndercoverWordCandidates,
  UndercoverPublication['storeCandidates']
> = true;
const undercoverFailPin: Exact<typeof failUndercoverWordPack, UndercoverPublication['fail']> = true;
const drawGuessReservePin: Exact<
  typeof reserveDrawGuessWordPack,
  (
    db: D1Database,
    day: string,
    batchIndex: number,
    opts?: ReserveOpts,
  ) => Promise<DrawGuessWordPack | null>
> = true;
const drawGuessStoreCandidatesPin: Exact<
  typeof storeDrawGuessWordCandidates,
  DrawGuessPublication['storeCandidates']
> = true;
const drawGuessFailPin: Exact<typeof failDrawGuessWordPack, DrawGuessPublication['fail']> = true;
const fibReservePin: Exact<
  typeof reserveFibWordPack,
  (
    db: D1Database,
    day: string,
    batchIndex: number,
    opts?: { force?: boolean; runId?: string; batchLimit?: number },
  ) => Promise<FibWordPack | null>
> = true;
const fibStoreCandidatesPin: Exact<
  typeof storeFibWordCandidates,
  FibPublication['storeCandidates']
> = true;
const fibFailPin: Exact<typeof failFibWordPack, FibPublication['fail']> = true;

/**
 * Opts key sets and member types, pinned separately: conditional type
 * identity alone does not distinguish an added optional opts field, so the
 * key union and each member type are asserted on their own.
 */
type UndercoverReserveOpts = NonNullable<Parameters<typeof reserveUndercoverWordPack>[3]>;
type DrawGuessReserveOpts = NonNullable<Parameters<typeof reserveDrawGuessWordPack>[3]>;
type FibReserveOpts = NonNullable<Parameters<typeof reserveFibWordPack>[3]>;

const undercoverReserveOptsKeysPin: Exact<keyof UndercoverReserveOpts, 'force' | 'runId'> = true;
const drawGuessReserveOptsKeysPin: Exact<keyof DrawGuessReserveOpts, 'force' | 'runId'> = true;
const fibReserveOptsKeysPin: Exact<keyof FibReserveOpts, 'force' | 'runId' | 'batchLimit'> = true;
const fibReserveBatchLimitTypePin: Exact<FibReserveOpts['batchLimit'], number | undefined> = true;

const typePins = [
  undercoverReservePin,
  undercoverStoreCandidatesPin,
  undercoverFailPin,
  drawGuessReservePin,
  drawGuessStoreCandidatesPin,
  drawGuessFailPin,
  fibReservePin,
  fibStoreCandidatesPin,
  fibFailPin,
  undercoverReserveOptsKeysPin,
  drawGuessReserveOptsKeysPin,
  fibReserveOptsKeysPin,
  fibReserveBatchLimitTypePin,
];

describe('word publication three-piece contract (P2)', () => {
  it('pins every piece of all three publications to the shared interface', () => {
    expect(typePins).toEqual(Array(typePins.length).fill(true));
  });

  it('exposes exactly the three publication pieces per game', () => {
    for (const publication of [undercoverPublication, drawGuessPublication, fibPublication]) {
      expect(Object.keys(publication).sort()).toEqual(['fail', 'reserve', 'storeCandidates']);
      for (const piece of Object.values(publication)) expect(typeof piece).toBe('function');
    }
  });
});

/**
 * P2 contract: all three games export the word publication five pieces
 * (reserve / getReviewCandidates / storeCandidates / publish / fail) from
 * their wordPublication module, each piece matching the shared
 * WordSupplyPublication interface.
 *
 * The satisfies blocks pin runner compatibility: a missing piece, an extra
 * required parameter, or a piece moved to another module fails typecheck.
 * The Exact pins cover the two sanctioned fibking deviations — reserve
 * carries batchLimit inside its opts and publish carries sourceUrls inside
 * its opts — plus the plain pieces of all three games and the opts key
 * sets, so any further signature drift also fails typecheck. Pins are
 * typed assignments (`const pin: Exact<...> = true`), never `as`
 * assertions: `true as false` typechecks, so an assertion-form pin would
 * silently hold nothing.
 */
import { describe, expect, it } from 'vitest';

import type {
  DrawGuessWordCandidate,
  DrawGuessWordReview,
} from '../../../games/drawguess/wordEditorial';
import {
  type DrawGuessWordPack,
  failDrawGuessWordPack,
  getDrawGuessReviewCandidates,
  publishDrawGuessWordPack,
  reserveDrawGuessWordPack,
  storeDrawGuessWordCandidates,
} from '../../../games/drawguess/wordPublication';
import type {
  FibWordEditorialCandidate,
  FibWordReview,
} from '../../../games/fibking/wordProviders/types';
import {
  failFibWordPack,
  type FibWordPack,
  getFibWordReviewCandidates,
  publishFibWordPack,
  reserveFibWordPack,
  storeFibWordCandidates,
} from '../../../games/fibking/wordPublication';
import type {
  UndercoverWordCandidate,
  UndercoverWordReview,
} from '../../../games/undercover/wordEditorial';
import {
  failUndercoverWordPack,
  getUndercoverReviewCandidates,
  publishUndercoverWordPack,
  reserveUndercoverWordPack,
  storeUndercoverWordCandidates,
  type UndercoverWordPack,
} from '../../../games/undercover/wordPublication';
import type { WordSupplyPublication } from '../wordSupplyWorkflow';

/** Strict type identity (mutual conditional identity), not just assignability. */
type Exact<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;

type UndercoverPublication = WordSupplyPublication<
  UndercoverWordPack,
  UndercoverWordCandidate,
  UndercoverWordReview
>;
type DrawGuessPublication = WordSupplyPublication<
  DrawGuessWordPack,
  DrawGuessWordCandidate,
  DrawGuessWordReview
>;
type FibPublication = WordSupplyPublication<FibWordPack, FibWordEditorialCandidate, FibWordReview>;

const undercoverPublication = {
  reserve: reserveUndercoverWordPack,
  getReviewCandidates: getUndercoverReviewCandidates,
  storeCandidates: storeUndercoverWordCandidates,
  publish: publishUndercoverWordPack,
  fail: failUndercoverWordPack,
} satisfies UndercoverPublication;

const drawGuessPublication = {
  reserve: reserveDrawGuessWordPack,
  getReviewCandidates: getDrawGuessReviewCandidates,
  storeCandidates: storeDrawGuessWordCandidates,
  publish: publishDrawGuessWordPack,
  fail: failDrawGuessWordPack,
} satisfies DrawGuessPublication;

const fibPublication = {
  reserve: reserveFibWordPack,
  getReviewCandidates: getFibWordReviewCandidates,
  storeCandidates: storeFibWordCandidates,
  publish: publishFibWordPack,
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
const undercoverGetReviewCandidatesPin: Exact<
  typeof getUndercoverReviewCandidates,
  UndercoverPublication['getReviewCandidates']
> = true;
const undercoverStoreCandidatesPin: Exact<
  typeof storeUndercoverWordCandidates,
  UndercoverPublication['storeCandidates']
> = true;
const undercoverPublishPin: Exact<
  typeof publishUndercoverWordPack,
  UndercoverPublication['publish']
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
const drawGuessGetReviewCandidatesPin: Exact<
  typeof getDrawGuessReviewCandidates,
  DrawGuessPublication['getReviewCandidates']
> = true;
const drawGuessStoreCandidatesPin: Exact<
  typeof storeDrawGuessWordCandidates,
  DrawGuessPublication['storeCandidates']
> = true;
const drawGuessPublishPin: Exact<typeof publishDrawGuessWordPack, DrawGuessPublication['publish']> =
  true;
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
const fibGetReviewCandidatesPin: Exact<
  typeof getFibWordReviewCandidates,
  FibPublication['getReviewCandidates']
> = true;
const fibStoreCandidatesPin: Exact<
  typeof storeFibWordCandidates,
  FibPublication['storeCandidates']
> = true;
const fibPublishPin: Exact<
  typeof publishFibWordPack,
  (
    db: D1Database,
    pack: FibWordPack,
    candidates: readonly FibWordEditorialCandidate[],
    reviews: readonly FibWordReview[],
    opts?: { readonly sourceUrls: readonly string[] },
  ) => Promise<void>
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
type FibPublishOpts = NonNullable<Parameters<typeof publishFibWordPack>[4]>;

const undercoverReserveOptsKeysPin: Exact<keyof UndercoverReserveOpts, 'force' | 'runId'> = true;
const drawGuessReserveOptsKeysPin: Exact<keyof DrawGuessReserveOpts, 'force' | 'runId'> = true;
const fibReserveOptsKeysPin: Exact<keyof FibReserveOpts, 'force' | 'runId' | 'batchLimit'> = true;
const fibReserveBatchLimitTypePin: Exact<FibReserveOpts['batchLimit'], number | undefined> = true;
const fibPublishOptsKeysPin: Exact<keyof FibPublishOpts, 'sourceUrls'> = true;
const fibPublishSourceUrlsTypePin: Exact<FibPublishOpts['sourceUrls'], readonly string[]> = true;

const typePins = [
  undercoverReservePin,
  undercoverGetReviewCandidatesPin,
  undercoverStoreCandidatesPin,
  undercoverPublishPin,
  undercoverFailPin,
  drawGuessReservePin,
  drawGuessGetReviewCandidatesPin,
  drawGuessStoreCandidatesPin,
  drawGuessPublishPin,
  drawGuessFailPin,
  fibReservePin,
  fibGetReviewCandidatesPin,
  fibStoreCandidatesPin,
  fibPublishPin,
  fibFailPin,
  undercoverReserveOptsKeysPin,
  drawGuessReserveOptsKeysPin,
  fibReserveOptsKeysPin,
  fibReserveBatchLimitTypePin,
  fibPublishOptsKeysPin,
  fibPublishSourceUrlsTypePin,
];

describe('word publication five-piece contract (P2)', () => {
  it('pins every piece of all three publications to the shared interface', () => {
    expect(typePins).toEqual(Array(typePins.length).fill(true));
  });

  it('exposes exactly the five publication pieces per game', () => {
    for (const publication of [undercoverPublication, drawGuessPublication, fibPublication]) {
      expect(Object.keys(publication).sort()).toEqual([
        'fail',
        'getReviewCandidates',
        'publish',
        'reserve',
        'storeCandidates',
      ]);
      for (const piece of Object.values(publication)) expect(typeof piece).toBe('function');
    }
  });
});

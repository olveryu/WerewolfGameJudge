/**
 * Cross-game review contract (docs/game-review-share-design.md §9.1).
 *
 * Every game type ships a review, and every review honours the platform's
 * rules on rounds played through the game's real engine: nothing to review
 * in the lobby; at the end, a document the platform accepts, named for its
 * game and room, that the host may share — resolved purely to plain data
 * and keyed by its round, so a new round never reuses the last round's
 * export. The registry covers every ported web game (docs/web-client-rewrite.md
 * §8.2) and becomes exhaustive over `GameType` once all are ported; the
 * new-game generator registers each new game's rounds (`<GAME>_REVIEW_ROUNDS`
 * in `packages/web/src/test-utils/<gameId>State.ts`).
 *
 * The source rules pin the boundary: only the platform's review module
 * renders, captures and shares a review, and an entry renders only through
 * `buildReviewBottomButton` / `buildReviewHostAction`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import { serializeReviewDocument } from '@/features/room/review/serializeReviewDocument';
import type {
  RoomReviewAvailability,
  RoomReviewContribution,
  RoomReviewDocument,
} from '@/features/room/review/types';
import { demoReview } from '@/games/demo/review/demoReview';
import { drawGuessReview } from '@/games/drawguess/review/drawGuessReview';
import { fibReview } from '@/games/fibking/review/fibReview';
import { pictionaryReview } from '@/games/pictionary/review/pictionaryReview';
import { storyRelayReview } from '@/games/storyrelay/review/storyRelayReview';
import { undercoverReview } from '@/games/undercover/review/undercoverReview';
import { werewolfReview } from '@/games/werewolf/review/werewolfReview';
import { DEMO_REVIEW_ROUNDS } from '@/test-utils/demoState';
import { DRAWGUESS_REVIEW_ROUNDS } from '@/test-utils/drawguessState';
import { FIBKING_REVIEW_ROUNDS } from '@/test-utils/fibkingState';
import { PICTIONARY_REVIEW_ROUNDS } from '@/test-utils/pictionaryState';
import type { ReviewTestRounds } from '@/test-utils/reviewTestRounds';
import { viewerFor } from '@/test-utils/roomViewer';
import { STORYRELAY_REVIEW_ROUNDS } from '@/test-utils/storyrelayState';
import { UNDERCOVER_REVIEW_ROUNDS } from '@/test-utils/undercoverState';
import { WEREWOLF_REVIEW_ROUNDS } from '@/test-utils/werewolfNightReview';

const ROOM_CODE = '1234';
const HOST = viewerFor('host');

/** One game's review over its rounds, resolved for the host. */
interface ReviewContractCase {
  readonly resolveLobby: () => RoomReviewAvailability;
  /** One finished round resolved twice, then as the room's next round. */
  readonly resolveEnded: () => {
    readonly first: RoomReviewAvailability;
    readonly again: RoomReviewAvailability;
    readonly nextRound: RoomReviewAvailability;
  };
}

function reviewCase<TState>(
  contribution: RoomReviewContribution<TState>,
  rounds: ReviewTestRounds<TState>,
): ReviewContractCase {
  const resolve = (state: TState) =>
    contribution.resolve({ state, viewer: HOST, roomCode: ROOM_CODE });
  return {
    resolveLobby: () => resolve(rounds.lobby()),
    resolveEnded: () => {
      const ended = rounds.ended();
      return {
        first: resolve(ended),
        again: resolve(ended),
        nextRound: resolve(rounds.nextRound(ended)),
      };
    },
  };
}

const REVIEW_CONTRACT = {
  werewolf: reviewCase(werewolfReview, WEREWOLF_REVIEW_ROUNDS),
  undercover: reviewCase(undercoverReview, UNDERCOVER_REVIEW_ROUNDS),
  fibking: reviewCase(fibReview, FIBKING_REVIEW_ROUNDS),
  storyrelay: reviewCase(storyRelayReview, STORYRELAY_REVIEW_ROUNDS),
  pictionary: reviewCase(pictionaryReview, PICTIONARY_REVIEW_ROUNDS),
  drawguess: reviewCase(drawGuessReview, DRAWGUESS_REVIEW_ROUNDS),
  demo: reviewCase(demoReview, DEMO_REVIEW_ROUNDS),
} as const satisfies Partial<Record<GameType, ReviewContractCase>>;

function documentOf(availability: RoomReviewAvailability): RoomReviewDocument {
  if (availability.kind !== 'available') {
    throw new Error(`expected an available review, got ${availability.kind}`);
  }
  return availability.document;
}

function plainData(document: RoomReviewDocument): string {
  return canonicalJson(serializeReviewDocument(document));
}

describe.each(Object.entries(REVIEW_CONTRACT))('%s review', (gameType, contract) => {
  it('has nothing to review in the lobby', () => {
    expect(contract.resolveLobby()).toEqual({ kind: 'notEnded' });
  });

  it('lets the host read and share a finished round as a well-formed document', () => {
    const { first } = contract.resolveEnded();
    if (first.kind !== 'available') throw new Error(`expected an available review`);
    expect(first.sharing).toEqual({ isAllowed: true });
    expect(() => assertReviewDocument(first.document)).not.toThrow();
    expect(first.document.fileStem).toMatch(new RegExp(`^${gameType}-${ROOM_CODE}(-|$)`));
    expect(first.document.kicker).not.toBe('');
    expect(first.document.footer).not.toBe('');
  });

  it('resolves the same round to the same plain data', () => {
    const { first, again } = contract.resolveEnded();
    expect(plainData(documentOf(again))).toBe(plainData(documentOf(first)));
  });

  it('keys the document by its round', () => {
    const { first, nextRound } = contract.resolveEnded();
    expect(documentOf(nextRound).roundKey).not.toBe(documentOf(first).roundKey);
  });
});

const SRC_DIR = join(import.meta.dirname, '..');
const REVIEW_DIR = join(SRC_DIR, 'features/room/review');

const TEST_SUPPORT_DIRS = new Set(['__tests__', '__mocks__', 'test-utils']);

function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return TEST_SUPPORT_DIRS.has(entry) ? [] : productionFiles(fullPath);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

/** Production files outside the review module whose source matches `pattern`. */
function violationsOutsideReview(pattern: RegExp): string[] {
  return productionFiles(SRC_DIR)
    .filter((file) => !file.startsWith(REVIEW_DIR))
    .filter((file) => pattern.test(readFileSync(file, 'utf-8')))
    .map((file) => relative(SRC_DIR, file));
}

describe('review boundary', () => {
  it('renders, captures and exports a review only inside the review module', () => {
    expect(
      violationsOutsideReview(/['"][^'"]*\breview\/(?:components\/|useRoomReviewExport['"])/),
    ).toEqual([]);
  });

  it('leaves image capture and the share sheet to the review module', () => {
    expect(
      productionFiles(join(SRC_DIR, 'games'))
        .filter((file) =>
          /['"][^'"]*\bservices\/(?:shareImage|captureElementPng)/.test(
            readFileSync(file, 'utf-8'),
          ),
        )
        .map((file) => relative(SRC_DIR, file)),
    ).toEqual([]);
  });

  it('renders review entries only through the entry builders', () => {
    expect(violationsOutsideReview(/key:\s*(HOST_ACTION_KEYS\.review\b|['"]review['"])/)).toEqual(
      [],
    );
    expect(violationsOutsideReview(/TESTIDS\.roomReview/)).toEqual([]);
  });
});

/**
 * 自然终局后对所有观看者开放；中止直接回大厅，不构造虚假的完成复盘。
 */

import type { SpotmatchState } from '@game-judge/game-engine/games/spotmatch/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toSpotmatchReviewDocument } from './toSpotmatchReviewDocument';

/** The Spotmatch review: available to every viewer once the game ended. */
export const spotmatchReview: RoomReviewContribution<SpotmatchState> = {
  resolve: ({ state, roomCode }) =>
    state.phase.kind === 'ended'
      ? {
          kind: 'available',
          document: toSpotmatchReviewDocument({ state, roomCode }),
          sharing: { isAllowed: true },
          confirmation: null,
        }
      : { kind: 'notEnded' },
};

/** The FibKing review contribution: when a round is reviewable and who may share it. */

import type { FibState } from '@game-judge/game-engine/games/fibking/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toFibReviewDocument } from './toFibReviewDocument';

/**
 * A round is reviewable once it ended — every identity and the true
 * definition are public then — so every reader may share it, with no
 * confirmation. A round abandoned mid-play returns to the lobby and
 * leaves nothing to review.
 */
export const fibReview: RoomReviewContribution<FibState> = {
  resolve: ({ state, roomCode }) =>
    state.phase === 'ended'
      ? {
          kind: 'available',
          document: toFibReviewDocument({
            round: state.round,
            numberOfPlayers: state.numberOfPlayers,
            roster: state.roster,
            roomCode,
          }),
          sharing: { isAllowed: true },
          confirmation: null,
        }
      : { kind: 'notEnded' },
};

/** The undercover review contribution: when a round is reviewable and who may share it. */

import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';

import type { RoomReviewContribution, RoomReviewDocument } from '@/features/room/review/types';

import { toUndercoverReviewDocument } from './toUndercoverReviewDocument';

function reviewedRound(state: UndercoverState, roomCode: string): RoomReviewDocument | null {
  switch (state.phase) {
    case 'ended':
      return toUndercoverReviewDocument({
        round: state.round,
        conclusion: { kind: 'won', winner: state.winner },
        config: state.config,
        roster: state.roster,
        roomCode,
      });
    case 'lobby':
    case 'preparing':
    case 'preparationFailed':
    case 'viewing':
    case 'ongoing':
      return null;
  }
}

/**
 * The document holds the public result of the completed round, so every
 * reader may share it, with no confirmation.
 */
export const undercoverReview: RoomReviewContribution<UndercoverState> = {
  resolve: ({ state, roomCode }) => {
    const document = reviewedRound(state, roomCode);
    return document === null
      ? { kind: 'notEnded' }
      : { kind: 'available', document, sharing: { isAllowed: true }, confirmation: null };
  },
};

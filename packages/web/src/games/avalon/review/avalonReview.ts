/**
 * The Avalon review contribution. A review exists once the game ended;
 * every identity is public by then, so everyone in the room — players
 * and spectators alike — reads and shares it, without a confirmation.
 * The document is built from the seatless public projection, so every
 * reader gets the same one.
 */

import { type AvalonState, getAvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toAvalonReviewDocument } from './toAvalonReviewDocument';

export const avalonReview: RoomReviewContribution<AvalonState> = {
  resolve: ({ state, roomCode }) => {
    if (state.phase.kind !== 'ended') return { kind: 'notEnded' };
    return {
      kind: 'available',
      document: toAvalonReviewDocument({
        viewModel: getAvalonViewModel(state, null),
        roomCode,
        gameSequence: state.gameSequence,
      }),
      sharing: { isAllowed: true },
      confirmation: null,
    };
  },
};

/**
 * The Story Relay review contribution: a round's stories are public to the
 * whole room once the round ends — or is aborted, keeping the passages
 * handed in — so every viewer reads and shares them, with nothing to
 * confirm.
 */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toStoryRelayReviewDocument } from './toStoryRelayReviewDocument';

/** The Story Relay 本局复盘, declared once in the client module. */
export const storyRelayReview: RoomReviewContribution<StoryRelayState> = {
  resolve: ({ state, roomCode }) => {
    if (state.phase !== 'ended' && state.phase !== 'aborted') return { kind: 'notEnded' };
    return {
      kind: 'available',
      document: toStoryRelayReviewDocument({ state, roomCode }),
      sharing: { isAllowed: true },
      confirmation: null,
    };
  },
};

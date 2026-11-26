/** Decrypto review becomes available to every viewer after the final result. */

import type { DecryptoState } from '@game-judge/game-engine/games/decrypto/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toDecryptoReviewDocument } from './toDecryptoReviewDocument';

/** The Decrypto review: available to every viewer once the game ended. */
export const decryptoReview: RoomReviewContribution<DecryptoState> = {
  resolve: ({ state, roomCode }) =>
    state.phase.kind === 'ended'
      ? {
          kind: 'available',
          document: toDecryptoReviewDocument({ state, roomCode }),
          sharing: { isAllowed: true },
          confirmation: null,
        }
      : { kind: 'notEnded' },
};

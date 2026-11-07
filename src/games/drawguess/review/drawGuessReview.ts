/**
 * The DrawGuess review contribution: the review exists once the game has
 * ended, every viewer may read and share it, and nothing needs confirming
 * — at the end every word, guess and score is public.
 *
 * Drawings load through the game's media transport. The media route
 * serves them to seated players only and answers 410 once a drawing
 * outlived the R2 lifecycle: both are final, honest absences that never
 * block the export; every other failure rejects so the reader can retry.
 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';

import type { ReviewImageLoadResult, RoomReviewContribution } from '@/features/room/review/types';
import { ApiError } from '@/platform/http/ApiError';

import { drawGuessMediaTransport } from '../services/drawGuessMediaTransport';
import { toDrawGuessReviewDocument } from './toDrawGuessReviewDocument';

const DRAWING_EXPIRED_MESSAGE = '画作已过期';
const DRAWING_SEATED_ONLY_MESSAGE = '入座的玩家才能查看画作';

/** Loads one review drawing, mapping the media route's final absences to `unavailable`. */
export async function loadDrawGuessReviewDrawing(
  roomCode: string,
  entryId: string,
  signal: AbortSignal,
): Promise<ReviewImageLoadResult> {
  try {
    const dataUri = await drawGuessMediaTransport.readDrawingDataUri(
      roomCode,
      entryId,
      null,
      signal,
    );
    return { kind: 'loaded', dataUri };
  } catch (error: unknown) {
    if (error instanceof ApiError && error.isHttp()) {
      if (error.status === 410) return { kind: 'unavailable', message: DRAWING_EXPIRED_MESSAGE };
      if (error.status === 403) {
        return { kind: 'unavailable', message: DRAWING_SEATED_ONLY_MESSAGE };
      }
    }
    throw error;
  }
}

/** The DrawGuess 本局复盘, declared once in the client module. */
export const drawGuessReview: RoomReviewContribution<DrawGuessState> = {
  resolve: ({ state, roomCode }) => {
    if (state.phase.kind !== 'ended') return { kind: 'notEnded' };
    return {
      kind: 'available',
      document: toDrawGuessReviewDocument({
        state,
        roomCode,
        loadDrawing: (entryId, signal) => loadDrawGuessReviewDrawing(roomCode, entryId, signal),
      }),
      sharing: { isAllowed: true },
      confirmation: null,
    };
  },
};

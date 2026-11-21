/**
 * The Pictionary review contribution. A round's albums are public to the
 * whole room once the round ends — or is aborted, keeping what was handed
 * in — so every viewer reads and shares them, with nothing to confirm.
 *
 * Drawings load through the game's media route
 * (`packages/api-worker/src/games/pictionary/mediaRoutes.ts`). Its
 * permanent refusals are honest absences that never block the export: 403
 * (the drawing is not readable), 404 (the room, its round or the entry is
 * gone), 409 `ROOM_GAME_TYPE_MISMATCH` (the room code now hosts another
 * game) and 410 (object storage no longer holds the filed drawing — its
 * lifecycle expired it). Every other failure — network, authentication,
 * any 5xx — rejects so the reader can retry.
 */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';

import type { ReviewImageLoadResult, RoomReviewContribution } from '@/features/room/review/types';
import { ApiError } from '@/platform/http/ApiError';

import { pictionaryMediaTransport } from '../services/pictionaryMediaTransport';
import { toPictionaryReviewDocument } from './toPictionaryReviewDocument';

const DRAWING_NOT_PERMITTED_MESSAGE = '无权查看这幅画作';
const DRAWING_GONE_MESSAGE = '画作已不存在';
const DRAWING_EXPIRED_MESSAGE = '画作已过期';
const ROOM_GAME_TYPE_MISMATCH = 'ROOM_GAME_TYPE_MISMATCH';

/** The honest absence behind a permanent media refusal; null for a failure a retry may clear. */
function permanentAbsenceMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.isHttp()) return null;
  switch (error.status) {
    case 403:
      return DRAWING_NOT_PERMITTED_MESSAGE;
    case 404:
      return DRAWING_GONE_MESSAGE;
    case 409:
      return error.reason === ROOM_GAME_TYPE_MISMATCH ? DRAWING_GONE_MESSAGE : null;
    case 410:
      return DRAWING_EXPIRED_MESSAGE;
    default:
      return null;
  }
}

async function loadReviewDrawing(
  roomCode: string,
  entryId: string,
  signal: AbortSignal,
): Promise<ReviewImageLoadResult> {
  try {
    const dataUri = await pictionaryMediaTransport.readDrawingDataUri(
      roomCode,
      entryId,
      null,
      signal,
    );
    return { kind: 'loaded', dataUri };
  } catch (error: unknown) {
    const message = permanentAbsenceMessage(error);
    if (message === null) throw error;
    return { kind: 'unavailable', message };
  }
}

/** The Pictionary 本局复盘, declared once in the client module. */
export const pictionaryReview: RoomReviewContribution<PictionaryState> = {
  resolve: ({ state, roomCode }) => {
    if (state.phase !== 'ended' && state.phase !== 'aborted') return { kind: 'notEnded' };
    return {
      kind: 'available',
      document: toPictionaryReviewDocument({
        state,
        roomCode,
        loadDrawing: (entryId, signal) => loadReviewDrawing(roomCode, entryId, signal),
      }),
      sharing: { isAllowed: true },
      confirmation: null,
    };
  },
};

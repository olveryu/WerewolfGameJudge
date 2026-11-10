/**
 * The Pictionary review contribution: available to every viewer once the
 * round ended or was aborted, and its drawings load through the real media
 * transport with the media route's permanent refusals mapped to
 * `unavailable` and every other failure left to retry.
 */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { ReviewImageBlock } from '@/features/room/review/types';
import { ApiError } from '@/platform/http/ApiError';
import { apiClient } from '@/platform/http/client';
import { buildPictionaryTestState, playPictionaryTestRound } from '@/test-utils/pictionaryState';

import { pictionaryReview } from '../pictionaryReview';

const readBinary = vi.spyOn(apiClient, 'binary');

const PNG_BYTES = [137, 80, 78, 71];
const MEDIA_PATH = '/api/games/pictionary/rooms/ABCD/media/entry';

const VIEWERS: readonly RoomViewer[] = [
  { userId: 'host-1', isHost: true, seat: 0 },
  { userId: 'u1', isHost: false, seat: 1 },
  { userId: 'spectator', isHost: false, seat: null },
];

function httpError(status: number, reason: string): ApiError {
  return new ApiError({ kind: 'http', path: MEDIA_PATH, status, reason });
}

function resolveFor(state: PictionaryState, viewer: RoomViewer) {
  return pictionaryReview.resolve({ state, viewer, roomCode: 'ABCD' });
}

function firstDrawing(state: PictionaryState): ReviewImageBlock {
  const availability = resolveFor(state, VIEWERS[2]!);
  if (availability.kind !== 'available') throw new Error('expected an available review');
  const image = availability.document.pages
    .flatMap((page) => page.blocks)
    .find((block) => block.kind === 'image');
  if (image?.kind !== 'image') throw new Error('expected a drawing');
  return image;
}

describe('pictionaryReview', () => {
  const ended = playPictionaryTestRound();
  const aborted = playPictionaryTestRound({ abortAtStep: 2 });

  beforeEach(() => {
    readBinary.mockReset();
  });

  it('has nothing to review before the round ends', () => {
    const states: readonly PictionaryState[] = [
      buildPictionaryTestState(),
      { ...ended, phase: 'answering' },
      { ...ended, phase: 'gallery' },
    ];
    for (const state of states) {
      expect(resolveFor(state, VIEWERS[0]!)).toEqual({ kind: 'notEnded' });
    }
  });

  it.each(VIEWERS)(
    'offers ended and aborted rounds to viewer seat $seat to read and share',
    (viewer) => {
      for (const state of [ended, aborted]) {
        const availability = resolveFor(state, viewer);
        if (availability.kind !== 'available') throw new Error('expected an available review');
        expect(availability.sharing).toEqual({ isAllowed: true });
        expect(availability.confirmation).toBeNull();
        expect(availability.document.isAborted).toBe(state.phase === 'aborted');
        expect(availability.document.pages).toHaveLength(state.chains.length);
      }
    },
  );

  it('reads a drawing through the media route as the viewer, without a controlled seat', async () => {
    readBinary.mockResolvedValue(new Uint8Array(PNG_BYTES).buffer);
    const image = firstDrawing(ended);
    const signal = new AbortController().signal;
    await expect(image.load(signal)).resolves.toEqual({
      kind: 'loaded',
      dataUri: `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}`,
    });
    expect(readBinary).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: `/api/games/pictionary/rooms/ABCD/media/${encodeURIComponent(image.assetId)}`,
        signal,
      }),
    );
  });

  it.each([
    [403, 'PICTIONARY_MEDIA_FORBIDDEN', '无权查看这幅画作'],
    [404, 'PICTIONARY_MEDIA_NOT_FOUND', '画作已不存在'],
    [404, 'ROOM_NOT_FOUND', '画作已不存在'],
    [404, 'ROOM_STATE_NOT_FOUND', '画作已不存在'],
    [409, 'ROOM_GAME_TYPE_MISMATCH', '画作已不存在'],
    [410, 'PICTIONARY_MEDIA_EXPIRED', '画作已过期'],
  ])('reports a %i %s read as an honest absence', async (status, reason, message) => {
    readBinary.mockRejectedValue(httpError(status, reason));
    await expect(firstDrawing(ended).load(new AbortController().signal)).resolves.toEqual({
      kind: 'unavailable',
      message,
    });
  });

  it.each([
    httpError(401, 'UNAUTHORIZED'),
    httpError(500, 'INTERNAL_ERROR'),
    httpError(503, 'SERVICE_UNAVAILABLE'),
    new ApiError({ kind: 'network', path: MEDIA_PATH }),
    new ApiError({ kind: 'timeout', path: MEDIA_PATH }),
    new ApiError({ kind: 'aborted', path: MEDIA_PATH }),
  ])('rejects a $kind failure ($status) so the reader can retry', async (error) => {
    readBinary.mockRejectedValue(error);
    await expect(firstDrawing(ended).load(new AbortController().signal)).rejects.toBe(error);
  });
});

/**
 * The DrawGuess review contribution: available once the game has ended,
 * readable and shareable by every viewer, and its drawings load through
 * the media transport with the route's final absences mapped to
 * `unavailable`.
 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { ApiError } from '@/platform/http/ApiError';
import {
  buildDrawGuessTestState,
  DRAWGUESS_TEST_PLAYER_NAMES,
  playDrawGuessTestGame,
} from '@/test-utils/drawguessState';

import { drawGuessMediaTransport } from '../../services/drawGuessMediaTransport';
import { drawGuessReview, loadDrawGuessReviewDrawing } from '../drawGuessReview';

jest.mock('../../services/drawGuessMediaTransport', () => ({
  drawGuessMediaTransport: { readDrawingDataUri: jest.fn(), uploadDrawing: jest.fn() },
}));

const readDrawingDataUri = jest.mocked(drawGuessMediaTransport.readDrawingDataUri);

const DATA_URI = 'data:image/png;base64,AA==';
const MEDIA_PATH = '/api/games/drawguess/rooms/ABCD/media/entry';

const VIEWERS: readonly RoomViewer[] = [
  { userId: 'host-1', isHost: true, seat: 0 },
  { userId: 'u1', isHost: false, seat: 1 },
  { userId: 'spectator', isHost: false, seat: null },
];

function httpError(status: number, reason: string): ApiError {
  return new ApiError({ kind: 'http', path: MEDIA_PATH, status, reason });
}

function resolveFor(state: DrawGuessState, viewer: RoomViewer) {
  return drawGuessReview.resolve({ state, viewer, roomCode: 'ABCD' });
}

describe('drawGuessReview', () => {
  const ended = playDrawGuessTestGame([{ guessers: [1], filesDrawing: true }]);

  beforeEach(() => {
    readDrawingDataUri.mockReset();
  });

  it('has nothing to review before the game ends', () => {
    const lobby = buildDrawGuessTestState();
    const inGame: DrawGuessState = {
      ...ended,
      phase: { kind: 'wordSelect', drawerSeat: 0, choices: [], deadlineAt: null },
    };
    for (const state of [lobby, inGame]) {
      expect(resolveFor(state, VIEWERS[0]!)).toEqual({ kind: 'notEnded' });
    }
  });

  it.each(VIEWERS)('offers the ended game to viewer seat $seat to read and share', (viewer) => {
    const availability = resolveFor(ended, viewer);
    if (availability.kind !== 'available') throw new Error('expected an available review');
    expect(availability.sharing).toEqual({ isAllowed: true });
    expect(availability.confirmation).toBeNull();
    expect(availability.document.fileStem).toBe('drawguess-ABCD-1');
    expect(availability.document.pages).toHaveLength(1 + ended.turnHistory.length);
  });

  it('loads a drawing through the media transport without a controlled seat', async () => {
    const availability = resolveFor(ended, VIEWERS[2]!);
    if (availability.kind !== 'available') throw new Error('expected an available review');
    const image = availability.document.pages
      .flatMap((page) => page.blocks)
      .find((block) => block.kind === 'image');
    if (image?.kind !== 'image') throw new Error('expected the filed drawing');
    expect(image.caption).toBe(`${DRAWGUESS_TEST_PLAYER_NAMES[0]}的终稿`);
    readDrawingDataUri.mockResolvedValue(DATA_URI);
    const signal = new AbortController().signal;
    await expect(image.load(signal)).resolves.toEqual({ kind: 'loaded', dataUri: DATA_URI });
    expect(readDrawingDataUri).toHaveBeenCalledWith('ABCD', image.assetId, null, signal);
  });

  it.each([
    [410, '画作已过期'],
    [403, '入座的玩家才能查看画作'],
  ])('reports a %i read as a final absence', async (status, message) => {
    readDrawingDataUri.mockRejectedValue(httpError(status, 'route reason'));
    await expect(
      loadDrawGuessReviewDrawing('ABCD', 'entry', new AbortController().signal),
    ).resolves.toEqual({ kind: 'unavailable', message });
  });

  it.each([
    httpError(404, '画作不存在'),
    httpError(500, 'SERVER_ERROR'),
    new ApiError({ kind: 'network', path: MEDIA_PATH }),
    new ApiError({ kind: 'aborted', path: MEDIA_PATH }),
  ])('rejects a $kind failure ($status) so the reader can retry', async (error) => {
    readDrawingDataUri.mockRejectedValue(error);
    await expect(
      loadDrawGuessReviewDrawing('ABCD', 'entry', new AbortController().signal),
    ).rejects.toBe(error);
  });
});

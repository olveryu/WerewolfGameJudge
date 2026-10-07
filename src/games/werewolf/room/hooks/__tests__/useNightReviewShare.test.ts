/** Report capture lifetimes preserve only the current room/user's image. */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';

import { captureNightReviewCard, shareNightReviewReportImage } from '../../shareNightReview';
import { useNightReviewShare } from '../useNightReviewShare';

jest.mock('../../shareNightReview');
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => false }));

const gameState = {
  status: GameStatus.Day,
  currentNightResults: {},
  players: new Map(),
  actions: new Map(),
  lastNightDeaths: [],
  roleRevealRandomNonce: 'round-1',
} as unknown as LocalGameState;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => jest.restoreAllMocks());

it('discards an old capture after account change and shares only the current image', async () => {
  let complete!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    complete = resolve;
  });
  jest
    .mocked(captureNightReviewCard)
    .mockReturnValueOnce(capture)
    .mockResolvedValueOnce('new-image');
  jest.mocked(shareNightReviewReportImage).mockResolvedValue('shared');
  const { result, rerender } = renderHook(
    ({ userId }: { userId: string }) => useNightReviewShare('room-1', '1234', userId, gameState),
    { initialProps: { userId: 'old-user' } },
  );
  let pending!: Promise<string | null>;
  await act(async () => {
    pending = result.current.beginReportCapture();
  });
  rerender({ userId: 'new-user' });
  await act(async () => {
    complete('old-image');
    await pending;
  });
  await expect(pending).resolves.toBeNull();
  await act(async () => {
    await result.current.shareNightReviewReportDirectly();
  });
  const getBase64 = jest.mocked(shareNightReviewReportImage).mock.calls[0]![0];
  await expect(getBase64()).resolves.toBe('new-image');
  expect(result.current.isCapturingShareCard).toBe(false);
});

it('reports capture failure and allows a fresh attempt', async () => {
  jest
    .mocked(captureNightReviewCard)
    .mockRejectedValueOnce(new Error('capture failed'))
    .mockResolvedValueOnce('retried-image');
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));
  await act(async () => {
    await result.current.beginReportCapture();
  });
  expect(handleError).toHaveBeenCalledTimes(1);
  expect(result.current.isCapturingShareCard).toBe(false);
  await act(async () => {
    expect(await result.current.beginReportCapture()).toBe('retried-image');
  });
});

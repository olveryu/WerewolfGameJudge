/**
 * Mini-program report sharing picks the segmented capture only while the
 * trial switch is on, and shares the same pre-capture cache as other
 * platforms instead of capturing on tap.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { CaptureProgressCallback } from '@/features/room/services/captureViewSegmentedPngBase64';
import { uploadShareImage } from '@/features/room/services/uploadShareImage';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';
import { wxPreviewImage } from '@/utils/miniProgram';

import { captureNightReviewCardSegmented, renderNightReviewToCanvas } from '../../shareNightReview';
import { useNightReviewShare } from '../useNightReviewShare';

let mockTrialEnabled = true;

jest.mock('../../shareNightReview', () => ({
  captureNightReviewCard: jest.fn(),
  captureNightReviewCardSegmented: jest.fn(),
  renderNightReviewToCanvas: jest.fn(),
  shareNightReviewReportImage: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors the module export name
  get SEGMENTED_CAPTURE_TRIAL_ENABLED() {
    return mockTrialEnabled;
  },
}));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/miniProgram', () => ({
  isMiniProgram: () => true,
  wxPreviewImage: jest.fn(),
}));
jest.mock('@/features/room/services/uploadShareImage', () => ({
  uploadShareImage: jest.fn(),
}));

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
  mockTrialEnabled = true;
  jest.mocked(uploadShareImage).mockResolvedValue('https://example.com/report.png');
  jest.mocked(wxPreviewImage).mockResolvedValue(undefined);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => jest.restoreAllMocks());

it('mounts the share card for the segmented capture and previews the uploaded image', async () => {
  let complete!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    complete = resolve;
  });
  jest.mocked(captureNightReviewCardSegmented).mockReturnValue(capture);
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let sharePromise!: Promise<boolean>;
  await act(async () => {
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  // The card only exists in the tree while a capture runs; the segmented
  // capture must be preceded by the mount this flag represents.
  expect(result.current.isCapturingShareCard).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);

  let shared!: boolean;
  await act(async () => {
    complete('segmented-image');
    shared = await sharePromise;
  });

  expect(result.current.isCapturingShareCard).toBe(false);
  expect(shared).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);
  expect(renderNightReviewToCanvas).not.toHaveBeenCalled();
  expect(uploadShareImage).toHaveBeenCalledWith('segmented-image');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
});

it('reuses the pre-captured image when sharing after the review opened', async () => {
  jest.mocked(captureNightReviewCardSegmented).mockResolvedValue('segmented-image');
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  await act(async () => {
    await result.current.beginReportCapture();
  });
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);
  expect(uploadShareImage).toHaveBeenCalledWith('segmented-image');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
});

it('joins the in-flight pre-capture instead of capturing twice when sharing early', async () => {
  let complete!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    complete = resolve;
  });
  jest.mocked(captureNightReviewCardSegmented).mockReturnValue(capture);
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let pending!: Promise<string | null>;
  let sharePromise!: Promise<boolean>;
  await act(async () => {
    pending = result.current.beginReportCapture();
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);

  let shared!: boolean;
  await act(async () => {
    complete('segmented-image');
    shared = await sharePromise;
    await pending;
  });

  expect(shared).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);
  expect(uploadShareImage).toHaveBeenCalledTimes(1);
  expect(uploadShareImage).toHaveBeenCalledWith('segmented-image');
});

it('exposes band progress during capture and clears it when capture settles', async () => {
  let complete!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    complete = resolve;
  });
  let reportProgress: CaptureProgressCallback | undefined;
  jest.mocked(captureNightReviewCardSegmented).mockImplementation((_ref, onProgress) => {
    reportProgress = onProgress;
    onProgress?.(0, 3);
    return capture;
  });
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let pending!: Promise<string | null>;
  await act(async () => {
    pending = result.current.beginReportCapture();
  });
  expect(result.current.reportCaptureProgress).toEqual({ done: 0, total: 3 });

  await act(async () => {
    reportProgress?.(2, 3);
  });
  expect(result.current.reportCaptureProgress).toEqual({ done: 2, total: 3 });

  await act(async () => {
    reportProgress?.(3, 3);
    complete('segmented-image');
    await pending;
  });
  expect(result.current.reportCaptureProgress).toBeNull();
});

it('prepares nothing when the trial switch is off because sharing draws with canvas', async () => {
  mockTrialEnabled = false;
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let prepared!: string | null;
  await act(async () => {
    prepared = await result.current.beginReportCapture();
  });

  expect(prepared).toBeNull();
  expect(result.current.isCapturingShareCard).toBe(false);
  expect(captureNightReviewCardSegmented).not.toHaveBeenCalled();
});

it('draws with the canvas renderer when the trial switch is off', async () => {
  mockTrialEnabled = false;
  jest.mocked(renderNightReviewToCanvas).mockReturnValue('drawn-image');
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(true);
  expect(renderNightReviewToCanvas).toHaveBeenCalledTimes(1);
  expect(captureNightReviewCardSegmented).not.toHaveBeenCalled();
  expect(uploadShareImage).toHaveBeenCalledWith('drawn-image');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
});

it('surfaces a segmented capture failure instead of silently falling back to drawing', async () => {
  jest
    .mocked(captureNightReviewCardSegmented)
    .mockRejectedValue(new Error('segmented capture failed'));
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(false);
  expect(handleError).toHaveBeenCalledTimes(1);
  expect(renderNightReviewToCanvas).not.toHaveBeenCalled();
  expect(uploadShareImage).not.toHaveBeenCalled();
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

/**
 * Mini-program report sharing uses the segmented capture and shares the
 * same pre-capture cache as other platforms instead of capturing on tap.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { CaptureProgressCallback } from '@/features/room/services/captureViewSegmentedPngBase64';
import { uploadShareImage } from '@/features/room/services/uploadShareImage';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';
import { wxPreviewImage } from '@/utils/miniProgram';

import { captureNightReviewCardSegmented } from '../../shareNightReview';
import { useNightReviewShare } from '../useNightReviewShare';

jest.mock('../../shareNightReview', () => ({
  captureNightReviewCard: jest.fn(),
  captureNightReviewCardSegmented: jest.fn(),
  shareNightReviewReportImage: jest.fn(),
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

it('surfaces a segmented capture failure instead of sharing', async () => {
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
  expect(uploadShareImage).not.toHaveBeenCalled();
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

it('presents the share run from tap through generation and upload until the preview takes over', async () => {
  let completeCapture!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    completeCapture = resolve;
  });
  let reportProgress: CaptureProgressCallback | undefined;
  jest.mocked(captureNightReviewCardSegmented).mockImplementation((_ref, onProgress) => {
    reportProgress = onProgress;
    return capture;
  });
  let completeUpload!: (value: string) => void;
  jest.mocked(uploadShareImage).mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        completeUpload = resolve;
      }),
  );
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let sharePromise!: Promise<boolean>;
  await act(async () => {
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  // From the tap on, the run is visible: generating first, with the
  // capture's real band progress as soon as the capture reports it.
  expect(result.current.shareRun).toEqual({ phase: 'capturing', progress: null });
  await act(async () => {
    reportProgress?.(0, 3);
  });
  expect(result.current.shareRun).toEqual({ phase: 'capturing', progress: { done: 0, total: 3 } });
  await act(async () => {
    reportProgress?.(2, 3);
  });
  expect(result.current.shareRun).toEqual({ phase: 'capturing', progress: { done: 2, total: 3 } });

  await act(async () => {
    completeCapture('segmented-image');
  });
  expect(result.current.shareRun).toEqual({ phase: 'uploading' });
  expect(wxPreviewImage).not.toHaveBeenCalled();

  let shared!: boolean;
  await act(async () => {
    completeUpload('https://example.com/report.png');
    shared = await sharePromise;
  });
  expect(shared).toBe(true);
  expect(result.current.shareRun).toBeNull();
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
});

it('cancelling during generation detaches the preview but keeps the capture for the next tap', async () => {
  let completeCapture!: (value: string) => void;
  const capture = new Promise<string>((resolve) => {
    completeCapture = resolve;
  });
  jest.mocked(captureNightReviewCardSegmented).mockReturnValue(capture);
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let sharePromise!: Promise<boolean>;
  await act(async () => {
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  expect(result.current.shareRun?.phase).toBe('capturing');

  await act(async () => {
    result.current.cancelReportShare();
  });
  expect(result.current.shareRun).toBeNull();

  let shared!: boolean;
  await act(async () => {
    completeCapture('segmented-image');
    shared = await sharePromise;
  });
  expect(shared).toBe(false);
  expect(uploadShareImage).not.toHaveBeenCalled();
  expect(wxPreviewImage).not.toHaveBeenCalled();

  // The capture was not killed: it landed in the cache, so sharing again
  // previews without capturing a second time.
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });
  expect(shared).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);
  expect(uploadShareImage).toHaveBeenCalledWith('segmented-image');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
});

it('cancelling during upload keeps the sent upload from opening the preview', async () => {
  jest.mocked(captureNightReviewCardSegmented).mockResolvedValue('segmented-image');
  let completeUpload!: (value: string) => void;
  jest.mocked(uploadShareImage).mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        completeUpload = resolve;
      }),
  );
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let sharePromise!: Promise<boolean>;
  await act(async () => {
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  expect(result.current.shareRun).toEqual({ phase: 'uploading' });

  await act(async () => {
    result.current.cancelReportShare();
  });
  expect(result.current.shareRun).toBeNull();

  let shared!: boolean;
  await act(async () => {
    completeUpload('https://example.com/report.png');
    shared = await sharePromise;
  });
  expect(shared).toBe(false);
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

it('skips the generating phase entirely when the image is already cached', async () => {
  jest.mocked(captureNightReviewCardSegmented).mockResolvedValue('segmented-image');
  let completeUpload!: (value: string) => void;
  jest.mocked(uploadShareImage).mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        completeUpload = resolve;
      }),
  );
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  await act(async () => {
    await result.current.beginReportCapture();
  });
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);

  let sharePromise!: Promise<boolean>;
  await act(async () => {
    sharePromise = result.current.shareNightReviewReportDirectly();
  });
  // The first observable run state is already the upload: no generating
  // phase flashes for an image that was captured when the review opened.
  expect(result.current.shareRun).toEqual({ phase: 'uploading' });

  await act(async () => {
    completeUpload('https://example.com/report.png');
    await sharePromise;
  });
  expect(result.current.shareRun).toBeNull();
  expect(wxPreviewImage).toHaveBeenCalledTimes(1);
});

it('clears the share run when generation fails', async () => {
  jest
    .mocked(captureNightReviewCardSegmented)
    .mockRejectedValue(new Error('segmented capture failed'));
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(false);
  expect(result.current.shareRun).toBeNull();
});

it('clears the share run when the upload fails', async () => {
  jest.mocked(captureNightReviewCardSegmented).mockResolvedValue('segmented-image');
  jest.mocked(uploadShareImage).mockRejectedValue(new Error('upload failed'));
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(false);
  expect(result.current.shareRun).toBeNull();
  expect(handleError).toHaveBeenCalled();
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

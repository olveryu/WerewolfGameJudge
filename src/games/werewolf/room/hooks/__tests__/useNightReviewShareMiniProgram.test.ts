/** Mini-program report sharing picks the segmented capture only while the trial switch is on. */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

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
});

it('captures the share card in segments and previews the uploaded image', async () => {
  jest.mocked(captureNightReviewCardSegmented).mockResolvedValue('segmented-image');
  const { result } = renderHook(() => useNightReviewShare('room-1', '1234', 'user-1', gameState));

  let shared!: boolean;
  await act(async () => {
    shared = await result.current.shareNightReviewReportDirectly();
  });

  expect(shared).toBe(true);
  expect(captureNightReviewCardSegmented).toHaveBeenCalledTimes(1);
  expect(renderNightReviewToCanvas).not.toHaveBeenCalled();
  expect(uploadShareImage).toHaveBeenCalledWith('segmented-image');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://example.com/report.png');
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

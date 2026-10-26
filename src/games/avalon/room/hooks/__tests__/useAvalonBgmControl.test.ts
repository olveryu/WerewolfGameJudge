/** Avalon BGM lifecycle uses saved preferences and never changes narration or game state. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { BGM_TRACKS } from '@/features/product/model/BgmCatalog';
import { handleError } from '@/utils/errorPipeline';

import { useAvalonBgmControl } from '../useAvalonBgmControl';

const mockSettingsService = {
  load: jest.fn(async (): Promise<void> => undefined),
  isBgmEnabled: jest.fn(() => true),
  getBgmTrack: jest.fn(() => 'random'),
  getBgmVolume: jest.fn(() => 0.3),
  getGameAudioVolume: jest.fn(() => 0.8),
};
const mockAudioService = {
  startBgm: jest.fn(async () => undefined),
  stopBgm: jest.fn(),
  setBgmVolume: jest.fn(),
  setGameAudioVolume: jest.fn(),
};
jest.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ settingsService: mockSettingsService, audioService: mockAudioService }),
}));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

function renderMusic(isHost = true, phase: AvalonPhaseKind = 'viewing', isAudioPlaying = false) {
  const initialProps = { isHost, phase, isAudioPlaying };
  return renderHook(
    (props: typeof initialProps) =>
      useAvalonBgmControl(props.isHost, props.phase, props.isAudioPlaying),
    { initialProps },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSettingsService.load.mockResolvedValue(undefined);
  mockSettingsService.isBgmEnabled.mockReturnValue(true);
  mockSettingsService.getBgmTrack.mockReturnValue('random');
  mockAudioService.startBgm.mockResolvedValue(undefined);
});

it('starts at night, preserves a manual pause across phases, and stops on return to lobby', async () => {
  const { result, rerender, unmount } = renderMusic();
  await waitFor(() => expect(mockAudioService.setGameAudioVolume).toHaveBeenCalledWith(0.8));
  expect(mockAudioService.startBgm).not.toHaveBeenCalled();
  rerender({ isHost: true, phase: 'night', isAudioPlaying: true });
  await waitFor(() => expect(result.current.isBgmPlaying).toBe(true));
  expect(mockAudioService.startBgm).toHaveBeenCalledWith(BGM_TRACKS.map((entry) => entry.asset));
  expect(mockAudioService.setBgmVolume).toHaveBeenCalledWith(0.3);
  act(() => result.current.stopBgm());
  rerender({ isHost: true, phase: 'vote', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(mockAudioService.startBgm).toHaveBeenCalledTimes(1);
  act(() => result.current.playBgm());
  rerender({ isHost: true, phase: 'lobby', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  mockAudioService.stopBgm.mockClear();
  unmount();
  expect(mockAudioService.stopBgm).toHaveBeenCalledTimes(1);
});

it('waits for terminal narration to finish before stopping music', async () => {
  const { result, rerender } = renderMusic(true, 'night', true);
  await waitFor(() => expect(result.current.isBgmPlaying).toBe(true));
  rerender({ isHost: true, phase: 'ended', isAudioPlaying: true });
  expect(result.current.isBgmPlaying).toBe(true);
  rerender({ isHost: true, phase: 'ended', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
});

it('uses the saved track, honors disabled auto-play, and permits an explicit play action', async () => {
  mockSettingsService.isBgmEnabled.mockReturnValue(false);
  mockSettingsService.getBgmTrack.mockReturnValue(BGM_TRACKS[0]!.id);
  const { result } = renderMusic(true, 'night');
  await waitFor(() => expect(mockAudioService.setGameAudioVolume).toHaveBeenCalled());
  expect(mockAudioService.startBgm).not.toHaveBeenCalled();
  act(() => result.current.playBgm());
  expect(mockAudioService.startBgm).toHaveBeenCalledWith([BGM_TRACKS[0]!.asset]);
});

it('does not start or stop shared audio for a player or spectator', () => {
  const { unmount } = renderMusic(false, 'night');
  unmount();
  expect(mockSettingsService.load).not.toHaveBeenCalled();
  expect(mockAudioService.startBgm).not.toHaveBeenCalled();
  expect(mockAudioService.stopBgm).not.toHaveBeenCalled();
});

it('stops music when host ownership is lost', async () => {
  const { result, rerender } = renderMusic(true, 'night');
  await waitFor(() => expect(result.current.isBgmPlaying).toBe(true));
  rerender({ isHost: false, phase: 'night', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(mockAudioService.stopBgm).toHaveBeenCalled();
});

it('does not start after unmount while settings are still loading', async () => {
  let resolveLoad!: () => void;
  mockSettingsService.load.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveLoad = resolve;
    }),
  );
  const { unmount } = renderMusic(true, 'night');
  unmount();
  await act(async () => {
    resolveLoad();
  });
  expect(mockAudioService.startBgm).not.toHaveBeenCalled();
});

it('reports playback failure without leaving the play control in the playing state', async () => {
  const error = new Error('playback failed');
  mockAudioService.startBgm.mockRejectedValue(error);
  const { result } = renderMusic(true, 'night');
  await waitFor(() =>
    expect(handleError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ label: '播放背景音乐' }),
    ),
  );
  expect(result.current.isBgmPlaying).toBe(false);
});

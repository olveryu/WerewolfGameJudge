/** Avalon BGM lifecycle uses saved preferences and never changes narration or game state. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { BGM_TRACKS } from '@/features/product/model/BgmCatalog';
import { audioSettings } from '@/features/settings/audioSettings';
import { createFakeBgm } from '@/test-utils/fakeBgm';

import type { AvalonAudioRuntime } from '../../../audio/AvalonAudioPlayer';
import { useAvalonBgmControl } from '../useAvalonBgmControl';

function createAudio() {
  return {
    playEffect: vi.fn(async () => undefined),
    preload: vi.fn(),
    stopNarration: vi.fn(),
    ...createFakeBgm(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
  } satisfies AvalonAudioRuntime;
}

let audio = createAudio();

function renderMusic(isHost = true, phase: AvalonPhaseKind = 'viewing', isAudioPlaying = false) {
  const initialProps = { isHost, phase, isAudioPlaying };
  return renderHook(
    (props: typeof initialProps) =>
      useAvalonBgmControl(audio, props.isHost, props.phase, props.isAudioPlaying),
    { initialProps },
  );
}

beforeEach(() => {
  audio = createAudio();
  audioSettings.setBgmEnabled(true);
  audioSettings.setBgmTrack('random');
  audioSettings.setBgmVolume(0.3);
  audioSettings.setGameAudioVolume(0.8);
});

afterEach(() => {
  localStorage.clear();
});

const allTrackUrls = () => BGM_TRACKS.map((entry) => entry.url);

it('starts at night, keeps a manual pause through the dawn tail, and stops on return to lobby', () => {
  const { result, rerender, unmount } = renderMusic();
  expect(audio.setGameAudioVolume).toHaveBeenCalledWith(0.8);
  expect(audio.startBgm).not.toHaveBeenCalled();
  rerender({ isHost: true, phase: 'night', isAudioPlaying: true });
  expect(result.current.isBgmPlaying).toBe(true);
  expect(audio.startBgm).toHaveBeenCalledWith(allTrackUrls());
  expect(audio.setBgmVolume).toHaveBeenCalledWith(0.3);
  act(() => result.current.stopBgm());
  rerender({ isHost: true, phase: 'vote', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(audio.startBgm).toHaveBeenCalledTimes(1);
  act(() => result.current.playBgm());
  rerender({ isHost: true, phase: 'lobby', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  audio.stopBgm.mockClear();
  unmount();
  expect(audio.stopBgm).toHaveBeenCalledTimes(1);
});

it('plays through the dawn tail, stops on the dawn ack, and never auto-plays during the day', () => {
  const { result, rerender } = renderMusic(true, 'night', true);
  expect(result.current.isBgmPlaying).toBe(true);
  // The engine advances to nominate before night_end is acked: still the auto window.
  rerender({ isHost: true, phase: 'nominate', isAudioPlaying: true });
  expect(result.current.isBgmPlaying).toBe(true);
  expect(audio.startBgm).toHaveBeenCalledTimes(1);
  // Dawn ack: the lifecycle leaves auto, the control syncs to the stopped player.
  rerender({ isHost: true, phase: 'nominate', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(audio.stopBgm).toHaveBeenCalled();
  // Day phases are manual-only: no auto start, and a host start survives phase changes.
  rerender({ isHost: true, phase: 'vote', isAudioPlaying: false });
  expect(audio.startBgm).toHaveBeenCalledTimes(1);
  act(() => result.current.playBgm());
  audio.stopBgm.mockClear();
  rerender({ isHost: true, phase: 'quest', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(true);
  expect(audio.stopBgm).not.toHaveBeenCalled();
  // Leaving play stops the manual session too.
  rerender({ isHost: true, phase: 'ended', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(audio.stopBgm).toHaveBeenCalledTimes(1);
});

it('waits for terminal narration to finish before stopping music', () => {
  const { result, rerender } = renderMusic(true, 'night', true);
  expect(result.current.isBgmPlaying).toBe(true);
  rerender({ isHost: true, phase: 'ended', isAudioPlaying: true });
  expect(result.current.isBgmPlaying).toBe(true);
  rerender({ isHost: true, phase: 'ended', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
});

it('uses the saved track, honors disabled auto-play, and permits an explicit play action', () => {
  audioSettings.setBgmEnabled(false);
  const firstTrack = BGM_TRACKS[0];
  if (firstTrack === undefined) throw new Error('BGM catalog is empty');
  audioSettings.setBgmTrack(firstTrack.id);
  const { result } = renderMusic(true, 'night');
  expect(audio.setGameAudioVolume).toHaveBeenCalled();
  expect(audio.startBgm).not.toHaveBeenCalled();
  act(() => result.current.playBgm());
  expect(audio.startBgm).toHaveBeenCalledWith([firstTrack.url]);
});

it('does not start or stop shared audio for a player or spectator', () => {
  const { unmount } = renderMusic(false, 'night');
  unmount();
  expect(audio.setGameAudioVolume).not.toHaveBeenCalled();
  expect(audio.startBgm).not.toHaveBeenCalled();
  expect(audio.stopBgm).not.toHaveBeenCalled();
});

it('shows the player stopping on its own instead of a stale playing state', () => {
  const { result } = renderMusic(true, 'night', true);
  expect(result.current.isBgmPlaying).toBe(true);
  act(() => audio.stopOnItsOwn());
  expect(result.current.isBgmPlaying).toBe(false);
});

it('stops music when host ownership is lost', () => {
  const { result, rerender } = renderMusic(true, 'night');
  expect(result.current.isBgmPlaying).toBe(true);
  rerender({ isHost: false, phase: 'night', isAudioPlaying: false });
  expect(result.current.isBgmPlaying).toBe(false);
  expect(audio.stopBgm).toHaveBeenCalled();
});

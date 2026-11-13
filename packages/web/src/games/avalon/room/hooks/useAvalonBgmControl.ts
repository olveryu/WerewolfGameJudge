/** Host-owned Avalon background music; narration and authoritative game state remain independent. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { resolveBgmTrackUrls } from '@/features/product/model/BgmCatalog';
import { audioSettings } from '@/features/settings/audioSettings';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';

/** Phases between dawn and the end of the game: music is under manual host control only. */
const AVALON_DAY_PHASES: ReadonlySet<AvalonPhaseKind> = new Set<AvalonPhaseKind>([
  'nominate',
  'vote',
  'voteResult',
  'quest',
  'lady',
  'assassin',
]);

/**
 * BGM lifecycle mode derived from authoritative state:
 * - auto: night narration plus its dawn tail (the engine advances phase to nominate
 *   before queueing night_end, so the tail is observable only through isAudioPlaying).
 * - manual: day phases; the host's play/pause choice survives phase changes.
 * - off: lobby / identity viewing / ended.
 */
type AvalonBgmLifecycle = 'auto' | 'manual' | 'off';

function resolveBgmLifecycle(phase: AvalonPhaseKind, isAudioPlaying: boolean): AvalonBgmLifecycle {
  if (phase === 'night' || isAudioPlaying) return 'auto';
  return AVALON_DAY_PHASES.has(phase) ? 'manual' : 'off';
}

export interface AvalonBgmControlState {
  /** Whether the player is actually playing BGM. */
  readonly isBgmPlaying: boolean;
  /** Start BGM unconditionally (respects the track setting) — the host's manual toggle. */
  readonly playBgm: () => void;
  /** Stop BGM immediately. */
  readonly stopBgm: () => void;
  /** Start BGM if enabled — called from the rejoin resume gesture. */
  readonly startBgmIfEnabled: () => void;
}

/**
 * Binds saved music preferences to Avalon lifecycle and explicit host playback controls.
 * Automatic BGM is night-only, matching werewolf. The shared audio core silences BGM
 * right before the dawn voice; the dawn ack moves the lifecycle from auto to manual,
 * which runs the (idempotent) stop below. Leaving play (lobby / ended) or losing host
 * ownership stops music. The play/pause control reads the player's own state.
 */
export function useAvalonBgmControl(
  audio: AvalonAudioRuntime,
  isHost: boolean,
  phase: AvalonPhaseKind,
  isAudioPlaying: boolean,
): AvalonBgmControlState {
  const isBgmPlaying = useSyncExternalStore(audio.subscribeBgm, audio.isBgmPlaying);
  const lifecycle = resolveBgmLifecycle(phase, isAudioPlaying);

  const stopBgm = audio.stopBgm;

  const playBgm = useCallback(() => {
    const settings = audioSettings.getSnapshot();
    audio.setBgmVolume(settings.bgmVolume);
    audio.startBgm(resolveBgmTrackUrls(settings.bgmTrack));
  }, [audio]);

  const startBgmIfEnabled = useCallback(() => {
    if (audioSettings.getSnapshot().bgmEnabled) playBgm();
  }, [playBgm]);

  useEffect(() => {
    if (!isHost) return;
    audio.setGameAudioVolume(audioSettings.getSnapshot().gameAudioVolume);
  }, [isHost, audio]);

  // Entering auto plays when enabled; entering manual (dawn ack) or off (lobby / viewing /
  // ended) stops. While the lifecycle stays manual this does not re-run, so host controls
  // persist.
  useEffect(() => {
    if (!isHost) return;
    if (lifecycle !== 'auto') {
      audio.stopBgm();
      return;
    }
    startBgmIfEnabled();
  }, [audio, isHost, lifecycle, startBgmIfEnabled]);

  useEffect(() => {
    if (!isHost) return;
    return stopBgm;
  }, [isHost, stopBgm]);

  return { isBgmPlaying, playBgm, stopBgm, startBgmIfEnabled };
}

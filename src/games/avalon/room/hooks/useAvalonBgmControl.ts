/** Host-owned Avalon background music; narration and authoritative game state remain independent. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useEffect, useState } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { BGM_TRACKS, getBgmTrack } from '@/features/product/model/BgmCatalog';
import { isExpectedStorageError } from '@/features/settings/services/SettingsService';
import { handleError } from '@/utils/errorPipeline';
import { bgmLog } from '@/utils/logger';

/** Phases between dawn and the end of the game: music is under manual host control only. */
const AVALON_DAY_PHASES: ReadonlySet<AvalonPhaseKind> = new Set<AvalonPhaseKind>([
  'nominate',
  'vote',
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

/**
 * Binds saved music preferences to Avalon lifecycle and explicit host playback controls.
 * Automatic BGM is night-only, matching werewolf. The shared audio core silences BGM
 * right before the dawn voice; the dawn ack moves the lifecycle from auto to manual,
 * which runs the (idempotent) stop below so the play/pause control reflects the real
 * player state. Leaving play (lobby / ended) or losing host ownership stops music.
 */
export function useAvalonBgmControl(
  isHost: boolean,
  phase: AvalonPhaseKind,
  isAudioPlaying: boolean,
) {
  const { settingsService, audioService } = useServices();
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const lifecycle = resolveBgmLifecycle(phase, isAudioPlaying);

  const stopBgm = useCallback(() => {
    audioService.stopBgm();
    setIsBgmPlaying(false);
  }, [audioService]);

  const playBgm = useCallback(() => {
    const track = settingsService.getBgmTrack();
    const assets =
      track === 'random' ? BGM_TRACKS.map((entry) => entry.asset) : [getBgmTrack(track).asset];
    audioService.setBgmVolume(settingsService.getBgmVolume());
    setIsBgmPlaying(true);
    void audioService.startBgm(assets).catch((error: unknown) => {
      setIsBgmPlaying(false);
      handleError(error, { label: '播放背景音乐', logger: bgmLog });
    });
  }, [audioService, settingsService]);

  useEffect(() => {
    if (!isHost) return;
    let isCancelled = false;
    void settingsService
      .load()
      .then(() => {
        if (isCancelled) return;
        audioService.setGameAudioVolume(settingsService.getGameAudioVolume());
        setIsSettingsLoaded(true);
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        handleError(error, {
          label: '加载音乐设置',
          logger: bgmLog,
          isExpected: isExpectedStorageError,
        });
      });
    return () => {
      isCancelled = true;
    };
  }, [isHost, settingsService, audioService]);

  useEffect(() => {
    if (!isHost || !isSettingsLoaded) return;
    if (lifecycle === 'auto') {
      if (settingsService.isBgmEnabled()) playBgm();
      return;
    }
    // Entering manual (dawn ack) or off (lobby / viewing / ended) stops music; while the
    // lifecycle stays manual this effect does not re-run, so host controls persist.
    stopBgm();
  }, [isHost, isSettingsLoaded, lifecycle, settingsService, playBgm, stopBgm]);

  useEffect(() => {
    if (!isHost) return;
    return stopBgm;
  }, [isHost, stopBgm]);

  return { isBgmPlaying, playBgm, stopBgm };
}

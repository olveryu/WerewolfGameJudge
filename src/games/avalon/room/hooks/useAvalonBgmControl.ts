/** Host-owned Avalon background music; narration and authoritative game state remain independent. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useEffect, useState } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { BGM_TRACKS, getBgmTrack } from '@/features/product/model/BgmCatalog';
import { isExpectedStorageError } from '@/features/settings/services/SettingsService';
import { handleError } from '@/utils/errorPipeline';
import { bgmLog } from '@/utils/logger';

/** Binds saved music preferences to Avalon lifecycle and explicit host playback controls. */
export function useAvalonBgmControl(
  isHost: boolean,
  phase: AvalonPhaseKind,
  isAudioPlaying: boolean,
) {
  const { settingsService, audioService } = useServices();
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const shouldAutoPlay =
    phase !== 'lobby' && phase !== 'viewing' && (phase !== 'ended' || isAudioPlaying);

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
    if (shouldAutoPlay) {
      if (settingsService.isBgmEnabled()) playBgm();
    } else {
      stopBgm();
    }
  }, [isHost, isSettingsLoaded, shouldAutoPlay, settingsService, playBgm, stopBgm]);

  useEffect(() => {
    if (!isHost) return;
    return stopBgm;
  }, [isHost, stopBgm]);

  return { isBgmPlaying, playBgm, stopBgm };
}

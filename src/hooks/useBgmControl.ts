/**
 * useBgmControl - BGM (background music) state management
 *
 * Manages:
 * - Loading BGM enabled setting on mount
 * - Toggling BGM on/off (persisted to SettingsService)
 * - Auto-stopping BGM when game ends AND ending audio finishes (Host only)
 *
 * 读写 BGM 设置、监听 game status 变化。
 * 不直接操作游戏状态。
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { BGM_TRACKS } from '@/services/infra/audio/audioRegistry';
import type { AudioAsset } from '@/services/infra/audio/types';
import { bgmLog } from '@/utils/logger';

export interface BgmControlState {
  isBgmEnabled: boolean;
  /** Whether BGM is currently playing (local UI state) */
  isBgmPlaying: boolean;
  toggleBgm: () => Promise<void>;
  /** Start BGM if enabled — call when game starts */
  startBgmIfEnabled: () => void;
  /** Start BGM unconditionally (respects track setting) — for manual user trigger */
  playBgm: () => void;
  /** Stop BGM immediately */
  stopBgm: () => void;
}

/**
 * Resolve BGM track setting to asset array.
 * 'random' → all tracks (BgmPlayer will shuffle); specific track → single-element array.
 */
function resolveBgmAssets(track: string): AudioAsset[] {
  if (track === 'random') {
    return BGM_TRACKS.map((t) => t.asset);
  }
  const entry = BGM_TRACKS.find((t) => t.id === track);
  return entry ? [entry.asset] : BGM_TRACKS.map((t) => t.asset);
}

/**
 * Manages BGM playback state.
 * Auto-stops BGM when game ends AND ending audio finishes (Host only).
 */
export function useBgmControl(
  isHost: boolean,
  gameStatus: GameStatus | null,
  isAudioPlaying: boolean,
): BgmControlState {
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const { settingsService, audioService } = useServices();
  const settingsRef = useRef(settingsService);
  const audioRef = useRef(audioService);
  useEffect(() => {
    settingsRef.current = settingsService;
    audioRef.current = audioService;
  }, [settingsService, audioService]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await settingsRef.current.load();
      setIsBgmEnabled(settingsRef.current.isBgmEnabled());
      // Apply persisted volume to audio service
      audioRef.current.setBgmVolume(settingsRef.current.getBgmVolume());
      audioRef.current.setRoleAudioVolume(settingsRef.current.getRoleAudioVolume());
    };
    loadSettings().catch((e) => {
      bgmLog.warn('Failed to load BGM settings:', e);
    });
  }, []);

  // 生命周期清理：游戏结束且所有音频播完后自动停 BGM。
  // 注意：音频时序层面的 stopBgm（如"天亮了"语音前停 BGM）由 GameFacade._playPendingAudioEffects 负责，
  // 这里仅作为最终生命周期兜底，确保 BGM 不会在 ended 状态残留。stopBgm() 幂等，重复调用无副作用。
  useEffect(() => {
    if (!isHost) return;
    if (gameStatus === GameStatus.Ended && !isAudioPlaying) {
      audioRef.current.stopBgm();
      setIsBgmPlaying(false);
    }
  }, [isHost, gameStatus, isAudioPlaying]);

  // Toggle BGM setting (host only)
  const toggleBgm = useCallback(async (): Promise<void> => {
    const newValue = await settingsRef.current.toggleBgm();
    setIsBgmEnabled(newValue);
    // If currently playing, stop/start based on new setting
    if (newValue) {
      // Only start if game is ongoing
      if (gameStatus === GameStatus.Ongoing) {
        const assets = resolveBgmAssets(settingsRef.current.getBgmTrack());
        audioRef.current.startBgm(assets).catch((e) => {
          bgmLog.warn('BGM start failed after toggle:', e);
        });
        setIsBgmPlaying(true);
      }
    } else {
      audioRef.current.stopBgm();
      setIsBgmPlaying(false);
    }
  }, [gameStatus]);

  // Start BGM if enabled (called by startGame)
  const startBgmIfEnabled = useCallback(() => {
    const bgmEnabled = settingsRef.current.isBgmEnabled();
    if (bgmEnabled) {
      const assets = resolveBgmAssets(settingsRef.current.getBgmTrack());
      audioRef.current.startBgm(assets).catch((e) => {
        bgmLog.warn('BGM start failed:', e);
      });
      setIsBgmPlaying(true);
    }
  }, []);

  // Start BGM unconditionally, respecting track setting (manual user trigger)
  const playBgm = useCallback(() => {
    const assets = resolveBgmAssets(settingsRef.current.getBgmTrack());
    audioRef.current.startBgm(assets).catch((e) => {
      bgmLog.warn('BGM manual play failed:', e);
    });
    setIsBgmPlaying(true);
  }, []);

  // Stop BGM (called by restartGame or manual user trigger)
  const stopBgm = useCallback(() => {
    audioRef.current.stopBgm();
    setIsBgmPlaying(false);
  }, []);

  return {
    isBgmEnabled,
    isBgmPlaying,
    toggleBgm,
    startBgmIfEnabled,
    playBgm,
    stopBgm,
  };
}

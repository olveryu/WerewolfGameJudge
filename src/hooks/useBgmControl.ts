/**
 * useBgmControl - BGM (background music) state management
 *
 * Manages:
 * - Loading BGM enabled setting on mount
 * - Toggling BGM on/off (persisted to SettingsService)
 * - Auto-stopping BGM when game ends AND ending audio finishes (Host only)
 *
 * 读写 BGM 设置、监听 game status 变化。
 * 不直接操作游戏状态，不调用 Supabase。
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { bgmLog } from '@/utils/logger';

export interface BgmControlState {
  isBgmEnabled: boolean;
  toggleBgm: () => Promise<void>;
  /** Start BGM if enabled — call when game starts */
  startBgmIfEnabled: () => void;
  /** Stop BGM immediately */
  stopBgm: () => void;
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
  const { settingsService, audioService } = useServices();
  const settingsRef = useRef(settingsService);
  const audioRef = useRef(audioService);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await settingsRef.current.load();
      setIsBgmEnabled(settingsRef.current.isBgmEnabled());
    };
    loadSettings().catch((e) => {
      bgmLog.warn('Failed to load BGM settings:', e);
    });
  }, []);

  // Auto-stop BGM when game ends AND ending audio finishes (Host only)
  // Night end flow: status→ended arrives while isAudioPlaying=true (last role ending + night_end
  // audio still playing). BGM must keep playing until all audio effects finish.
  useEffect(() => {
    if (!isHost) return;
    if (gameStatus === GameStatus.ended && !isAudioPlaying) {
      audioRef.current.stopBgm();
    }
  }, [isHost, gameStatus, isAudioPlaying]);

  // Toggle BGM setting (host only)
  const toggleBgm = useCallback(async (): Promise<void> => {
    const newValue = await settingsRef.current.toggleBgm();
    setIsBgmEnabled(newValue);
    // If currently playing, stop/start based on new setting
    if (newValue) {
      // Only start if game is ongoing
      if (gameStatus === GameStatus.ongoing) {
        audioRef.current.startBgm().catch((e) => {
          bgmLog.warn('BGM start failed after toggle:', e);
        });
      }
    } else {
      audioRef.current.stopBgm();
    }
  }, [gameStatus]);

  // Start BGM if enabled (called by startGame)
  const startBgmIfEnabled = useCallback(() => {
    const bgmEnabled = settingsRef.current.isBgmEnabled();
    if (bgmEnabled) {
      audioRef.current.startBgm().catch((e) => {
        bgmLog.warn('BGM start failed:', e);
      });
    }
  }, []);

  // Stop BGM (called by restartGame)
  const stopBgm = useCallback(() => {
    audioRef.current.stopBgm();
  }, []);

  return {
    isBgmEnabled,
    toggleBgm,
    startBgmIfEnabled,
    stopBgm,
  };
}

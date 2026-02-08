/**
 * useBgmControl - BGM (background music) state management
 *
 * Manages:
 * - Loading BGM enabled setting on mount
 * - Toggling BGM on/off (persisted to SettingsService)
 * - Auto-stopping BGM when game transitions from ongoing → ended (Host only)
 *
 * ✅ 允许：读写 BGM 设置、监听 game status 变化
 * ❌ 禁止：直接操作游戏状态、调用 Supabase
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus } from '@/models/GameStatus';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';

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
 * Auto-stops BGM when game transitions from ongoing → ended (Host only).
 */
export function useBgmControl(
  isHost: boolean,
  gameStatus: GameStatus | null,
): BgmControlState {
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const settingsService = useRef(SettingsService.getInstance());
  const audioService = useRef(AudioService.getInstance());

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await settingsService.current.load();
      setIsBgmEnabled(settingsService.current.isBgmEnabled());
    };
    loadSettings().catch(() => {
      // Ignore — settings load failure is non-critical
    });
  }, []);

  // Auto-stop BGM when game ends (Host only)
  const prevStatusRef = useRef<GameStatus | null>(null);
  useEffect(() => {
    if (!isHost) return;
    const currentStatus = gameStatus ?? null;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = currentStatus;

    // Stop BGM when transitioning from ongoing to ended
    if (prevStatus === GameStatus.ongoing && currentStatus === GameStatus.ended) {
      audioService.current.stopBgm();
    }
  }, [isHost, gameStatus]);

  // Toggle BGM setting (host only)
  const toggleBgm = useCallback(async (): Promise<void> => {
    const newValue = await settingsService.current.toggleBgm();
    setIsBgmEnabled(newValue);
    // If currently playing, stop/start based on new setting
    if (newValue) {
      // Only start if game is ongoing
      if (gameStatus === GameStatus.ongoing) {
        audioService.current.startBgm().catch(() => {
          // Ignore — BGM start failure is non-critical
        });
      }
    } else {
      audioService.current.stopBgm();
    }
  }, [gameStatus]);

  // Start BGM if enabled (called by startGame)
  const startBgmIfEnabled = useCallback(() => {
    const bgmEnabled = settingsService.current.isBgmEnabled();
    if (bgmEnabled) {
      audioService.current.startBgm().catch(() => {
        // Ignore — BGM start failure is non-critical
      });
    }
  }, []);

  // Stop BGM (called by restartGame)
  const stopBgm = useCallback(() => {
    audioService.current.stopBgm();
  }, []);

  return {
    isBgmEnabled,
    toggleBgm,
    startBgmIfEnabled,
    stopBgm,
  };
}

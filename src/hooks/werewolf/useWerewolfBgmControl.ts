/**
 * useWerewolfBgmControl - BGM (background music) state management
 *
 * Manages:
 * - Loading BGM enabled setting on mount
 * - Toggling BGM on/off (persisted to SettingsService)
 * - Auto-stopping BGM when game ends AND ending audio finishes (Host only)
 *
 * Read/write BGM settings, watch game status changes.
 * Does not directly operate on game state.
 */

import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
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
  /** Start BGM if enabled — call on rejoin (user gesture context) */
  startBgmIfEnabled: () => void;
  /** Start BGM unconditionally (respects track setting) — for manual user trigger */
  playBgm: () => void;
  /** Stop BGM immediately */
  stopBgm: () => void;
}

/**
 * Resolve BGM track setting to asset array.
 * 'random' -> all tracks (BgmPlayer will shuffle); specific track -> single-element array.
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
export function useWerewolfBgmControl(
  isHost: boolean,
  gameStatus: GameStatus | null,
  isAudioPlaying: boolean,
): BgmControlState {
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const { settingsService, audioService } = useServices();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await settingsService.load();
      setIsBgmEnabled(settingsService.isBgmEnabled());
      // Apply persisted volume to audio service
      audioService.setBgmVolume(settingsService.getBgmVolume());
      audioService.setRoleAudioVolume(settingsService.getRoleAudioVolume());
    };
    loadSettings().catch((e) => {
      bgmLog.warn('Failed to load BGM settings', e);
    });
  }, [settingsService, audioService]);

  // ── State-driven: gameStatus transitions to Ongoing -> start BGM ──
  // BGM start driven by WerewolfState transitions (symmetric to stop), not bound to HTTP response.
  // Guard: prevStatus === null excludes mount/rejoin (null->Ongoing);
  // rejoin scenario is started manually by resumeAfterRejoin.
  const prevStatusRef = useRef<GameStatus | null>(null);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = gameStatus;

    if (!isHost) return;
    if (
      gameStatus === GameStatus.Ongoing &&
      prevStatus !== null &&
      prevStatus !== GameStatus.Ongoing
    ) {
      const bgmEnabled = settingsService.isBgmEnabled();
      if (bgmEnabled) {
        const assets = resolveBgmAssets(settingsService.getBgmTrack());
        audioService.startBgm(assets).catch((e) => {
          bgmLog.warn('BGM start failed on state transition', e);
        });
        setIsBgmPlaying(true);
      }
    }
  }, [isHost, gameStatus, settingsService, audioService]);

  // ── State-driven: gameStatus transitions to Ended -> stop BGM ──
  // Audio-timing-level stopBgm (e.g. stopping BGM before "天亮了" voice) is handled by AudioOrchestrator;
  // here it serves as lifecycle cleanup to ensure BGM doesn't linger in ended state. stopBgm() is idempotent.
  useEffect(() => {
    if (!isHost) return;
    if (gameStatus === GameStatus.Ended && !isAudioPlaying) {
      audioService.stopBgm();
      setIsBgmPlaying(false);
    }
  }, [isHost, gameStatus, isAudioPlaying, audioService]);

  // Toggle BGM setting (host only)
  const toggleBgm = useCallback(async (): Promise<void> => {
    const newValue = await settingsService.toggleBgm();
    setIsBgmEnabled(newValue);
    // If currently playing, stop/start based on new setting
    if (newValue) {
      // Only start if game is ongoing
      if (gameStatus === GameStatus.Ongoing) {
        const assets = resolveBgmAssets(settingsService.getBgmTrack());
        audioService.startBgm(assets).catch((e) => {
          bgmLog.warn('BGM start failed after toggle', e);
        });
        setIsBgmPlaying(true);
      }
    } else {
      audioService.stopBgm();
      setIsBgmPlaying(false);
    }
  }, [gameStatus, settingsService, audioService]);

  // Start BGM if enabled (called by resumeAfterRejoin — user gesture context)
  const startBgmIfEnabled = useCallback(() => {
    const bgmEnabled = settingsService.isBgmEnabled();
    if (bgmEnabled) {
      const assets = resolveBgmAssets(settingsService.getBgmTrack());
      audioService.startBgm(assets).catch((e) => {
        bgmLog.warn('BGM start failed', e);
      });
      setIsBgmPlaying(true);
    }
  }, [settingsService, audioService]);

  // Start BGM unconditionally, respecting track setting (manual user trigger)
  const playBgm = useCallback(() => {
    const assets = resolveBgmAssets(settingsService.getBgmTrack());
    audioService.startBgm(assets).catch((e) => {
      bgmLog.warn('BGM manual play failed', e);
    });
    setIsBgmPlaying(true);
  }, [settingsService, audioService]);

  // Stop BGM (called by restartGame or manual user trigger)
  const stopBgm = useCallback(() => {
    audioService.stopBgm();
    setIsBgmPlaying(false);
  }, [audioService]);

  return {
    isBgmEnabled,
    isBgmPlaying,
    toggleBgm,
    startBgmIfEnabled,
    playBgm,
    stopBgm,
  };
}

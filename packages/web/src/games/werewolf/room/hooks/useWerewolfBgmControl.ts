/**
 * useWerewolfBgmControl — the host's background music during the night.
 *
 * Applies the persisted volumes on mount, starts the music when the night begins (a status
 * transition into Ongoing, never on mount: a rejoin restarts it from the resume gate's gesture),
 * stops it once the game ended and its ending narration finished, and gives the host the manual
 * play/stop toggle. Settings are read from the audio settings store at the moment they apply.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { resolveBgmTrackUrls } from '@/features/product/model/BgmCatalog';
import { audioSettings } from '@/features/settings/audioSettings';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';

export interface WerewolfBgmControlState {
  /** Whether the player is actually playing BGM. */
  readonly isBgmPlaying: boolean;
  /** Start BGM if enabled — called from the rejoin resume gesture. */
  readonly startBgmIfEnabled: () => void;
  /** Start BGM unconditionally (respects the track setting) — the host's manual toggle. */
  readonly playBgm: () => void;
  /** Stop BGM immediately. */
  readonly stopBgm: () => void;
}

export function useWerewolfBgmControl(
  audio: WerewolfAudioRuntime,
  isHost: boolean,
  gameStatus: GameStatus,
  isAudioPlaying: boolean,
): WerewolfBgmControlState {
  const isBgmPlaying = useSyncExternalStore(audio.subscribeBgm, audio.isBgmPlaying);

  useEffect(() => {
    const settings = audioSettings.getSnapshot();
    audio.setBgmVolume(settings.bgmVolume);
    audio.setGameAudioVolume(settings.gameAudioVolume);
  }, [audio]);

  const playBgm = useCallback(() => {
    audio.startBgm(resolveBgmTrackUrls(audioSettings.getSnapshot().bgmTrack));
  }, [audio]);

  const startBgmIfEnabled = useCallback(() => {
    if (audioSettings.getSnapshot().bgmEnabled) playBgm();
  }, [playBgm]);

  const stopBgm = audio.stopBgm;

  // A transition into the night starts the music; a mount in the night (rejoin) does not, the
  // resume gate's gesture restarts it.
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
      startBgmIfEnabled();
    }
  }, [gameStatus, isHost, startBgmIfEnabled]);

  // Lifecycle cleanup once the ending narration finished; the dawn cut before 天亮了 is the
  // audio orchestrator's `stopBgm` timing hook. Only the transition stops it, so a manual
  // play afterwards keeps playing.
  const isEndedAndQuiet = isHost && gameStatus === GameStatus.Ended && !isAudioPlaying;
  useEffect(() => {
    if (isEndedAndQuiet) audio.stopBgm();
  }, [audio, isEndedAndQuiet]);

  return { isBgmPlaying, startBgmIfEnabled, playBgm, stopBgm };
}

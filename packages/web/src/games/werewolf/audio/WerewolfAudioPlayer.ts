/** Werewolf narration semantics layered over the platform audio primitives. */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';

import type { AudioClip } from '@/features/product/model/AudioClip';

import {
  getWerewolfNightAudio,
  getWerewolfNightEndAudio,
  getWerewolfPreloadAudio,
  resolveWerewolfBeginningAudio,
  resolveWerewolfEndingAudio,
} from './audioRegistry';

export interface WerewolfAudioRuntime {
  readonly playEffect: (audioKey: string, isEndAudio?: boolean) => Promise<void>;
  /** Starts buffering narration for the public board, never the secret assignment. */
  readonly preload: (roles: readonly RoleId[]) => void;
  readonly stopNarration: () => void;
  /** Starts background music: one URL loops, several shuffle; no-op while playing. */
  readonly startBgm: (urls: readonly string[]) => void;
  readonly stopBgm: () => void;
  /** Actual BGM playback state, for `useSyncExternalStore`. */
  readonly isBgmPlaying: () => boolean;
  readonly subscribeBgm: (listener: () => void) => () => void;
  readonly setBgmVolume: (volume: number) => void;
  readonly setGameAudioVolume: (volume: number) => void;
  readonly clearPreloaded: () => void;
}

export interface WerewolfAudioPlaybackPort {
  playClip(clip: AudioClip): Promise<void>;
  preloadClips(clips: readonly AudioClip[]): void;
  stop(): void;
  startBgm(urls: readonly string[]): void;
  stopBgm(): void;
  isBgmPlaying(): boolean;
  subscribeBgm(listener: () => void): () => void;
  setBgmVolume(volume: number): void;
  setGameAudioVolume(volume: number): void;
  clearPreloaded(): void;
}

export class WerewolfAudioPlayer implements WerewolfAudioRuntime {
  readonly #audioService: WerewolfAudioPlaybackPort;

  constructor(audioService: WerewolfAudioPlaybackPort) {
    this.#audioService = audioService;
  }

  /** Resolves game narration semantics before delegating to platform playback. */
  readonly playEffect = (audioKey: string, isEndAudio?: boolean): Promise<void> => {
    if (isEndAudio) return this.#audioService.playClip(resolveWerewolfEndingAudio(audioKey));
    if (audioKey === 'night') return this.#audioService.playClip(getWerewolfNightAudio());
    if (audioKey === NIGHT_END_AUDIO_KEY) {
      return this.#audioService.playClip(getWerewolfNightEndAudio());
    }
    return this.#audioService.playClip(resolveWerewolfBeginningAudio(audioKey));
  };

  readonly preload = (roles: readonly RoleId[]): void =>
    this.#audioService.preloadClips(getWerewolfPreloadAudio(roles));

  readonly stopNarration = (): void => this.#audioService.stop();

  readonly startBgm = (urls: readonly string[]): void => this.#audioService.startBgm(urls);

  readonly stopBgm = (): void => this.#audioService.stopBgm();

  readonly isBgmPlaying = (): boolean => this.#audioService.isBgmPlaying();

  readonly subscribeBgm = (listener: () => void): (() => void) =>
    this.#audioService.subscribeBgm(listener);

  readonly setBgmVolume = (volume: number): void => this.#audioService.setBgmVolume(volume);

  readonly setGameAudioVolume = (volume: number): void =>
    this.#audioService.setGameAudioVolume(volume);

  readonly clearPreloaded = (): void => this.#audioService.clearPreloaded();
}

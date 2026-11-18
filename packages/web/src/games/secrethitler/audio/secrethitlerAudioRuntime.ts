import type { AudioEffect } from '@game-judge/game-engine/games/secrethitler/public';

import type { AudioClip } from '@/features/product/model/AudioClip';
import type { RoomBgmPlaybackPort } from '@/features/room/audio/useRoomBgmControl';

import { getSecrethitlerPreloadAudio, resolveSecrethitlerAudio } from './secrethitlerAudioRegistry';

export interface SecrethitlerAudioRuntime extends RoomBgmPlaybackPort {
  readonly playEffect: (effect: AudioEffect) => Promise<void>;
  readonly preload: () => void;
  readonly stopNarration: () => void;
  readonly stopBgm: () => void;
}

/** Platform audio operations used by the Secret Hitler player. */
export interface SecrethitlerAudioPlaybackPort extends RoomBgmPlaybackPort {
  playClip(clip: AudioClip): Promise<void>;
  preloadClips(clips: readonly AudioClip[]): void;
  stop(): void;
  stopBgm(): void;
}

/** Adapts Secret Hitler cue keys to the shared offline audio service. */
export class SecrethitlerAudioPlayer implements SecrethitlerAudioRuntime {
  readonly #audioService: SecrethitlerAudioPlaybackPort;

  constructor(audioService: SecrethitlerAudioPlaybackPort) {
    this.#audioService = audioService;
  }

  readonly playEffect = (effect: AudioEffect): Promise<void> =>
    this.#audioService.playClip(resolveSecrethitlerAudio(effect.audioKey));

  readonly preload = (): void => this.#audioService.preloadClips(getSecrethitlerPreloadAudio());

  readonly stopNarration = (): void => this.#audioService.stop();

  readonly stopBgm = (): void => this.#audioService.stopBgm();
  readonly startBgm = (urls: readonly string[]): void => this.#audioService.startBgm(urls);
  readonly isBgmPlaying = (): boolean => this.#audioService.isBgmPlaying();
  readonly subscribeBgm = (listener: () => void): (() => void) =>
    this.#audioService.subscribeBgm(listener);
  readonly setBgmVolume = (volume: number): void => this.#audioService.setBgmVolume(volume);
  readonly setGameAudioVolume = (volume: number): void =>
    this.#audioService.setGameAudioVolume(volume);
}

import type { AudioEffect } from '@game-judge/game-engine/games/secrethitler/public';

import type { AudioClip } from '@/features/product/model/AudioClip';

import { getSecrethitlerPreloadAudio, resolveSecrethitlerAudio } from './secrethitlerAudioRegistry';

export interface SecrethitlerAudioRuntime {
  readonly playEffect: (effect: AudioEffect) => Promise<void>;
  readonly preload: () => void;
  readonly stopNarration: () => void;
  readonly stopBgm: () => void;
}

/** Platform audio operations used by the Secret Hitler player. */
export interface SecrethitlerAudioPlaybackPort {
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
}

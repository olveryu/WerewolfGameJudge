/** Werewolf narration semantics layered over the platform audio primitives. */

import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';

import type { AudioClip } from '@/features/product/model/AudioClip';

import {
  getWerewolfNightAudio,
  getWerewolfNightEndAudio,
  getWerewolfPreloadAudio,
  resolveWerewolfBeginningAudio,
  resolveWerewolfEndingAudio,
} from './audioRegistry';

export interface WerewolfAudioRuntime {
  readonly playBeginning: (audioKey: string) => Promise<void>;
  readonly playEnding: (audioKey: string) => Promise<void>;
  readonly playNight: () => Promise<void>;
  readonly playNightEnd: () => Promise<void>;
  readonly preloadRoles: (roles: readonly RoleId[]) => Promise<void>;
  readonly stopNarration: () => void;
  readonly stopBgm: () => void;
  readonly clearPreloaded: () => void;
}

export interface WerewolfAudioPlaybackPort {
  playClip(clip: AudioClip): Promise<void>;
  preloadClips(clips: readonly AudioClip[]): Promise<void>;
  stop(): void;
  stopBgm(): void;
  clearPreloaded(): void;
}

export class WerewolfAudioPlayer implements WerewolfAudioRuntime {
  readonly #audioService: WerewolfAudioPlaybackPort;

  constructor(audioService: WerewolfAudioPlaybackPort) {
    this.#audioService = audioService;
  }

  readonly playBeginning = (audioKey: string): Promise<void> =>
    this.#audioService.playClip(resolveWerewolfBeginningAudio(audioKey));

  readonly playEnding = (audioKey: string): Promise<void> =>
    this.#audioService.playClip(resolveWerewolfEndingAudio(audioKey));

  readonly playNight = (): Promise<void> => this.#audioService.playClip(getWerewolfNightAudio());

  readonly playNightEnd = (): Promise<void> =>
    this.#audioService.playClip(getWerewolfNightEndAudio());

  readonly preloadRoles = (roles: readonly RoleId[]): Promise<void> =>
    this.#audioService.preloadClips(getWerewolfPreloadAudio(roles));

  readonly stopNarration = (): void => this.#audioService.stop();

  readonly stopBgm = (): void => this.#audioService.stopBgm();

  readonly clearPreloaded = (): void => this.#audioService.clearPreloaded();
}

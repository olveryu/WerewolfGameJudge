/**
 * 阿瓦隆第一晚播报播放器 — 对齐狼人杀 WerewolfAudioPlayer。
 * 语义层，实际播放走平台 AudioService。
 */

import type { AudioClip } from '@/features/product/model/AudioClip';

import {
  getAvalonPreloadAudio,
  resolveAvalonBeginningAudio,
  resolveAvalonEndingAudio,
} from './avalonAudioRegistry';

export interface AvalonAudioRuntime {
  readonly playEffect: (audioKey: string, isEndAudio?: boolean) => Promise<void>;
  /** Starts buffering all first-night clips. */
  readonly preload: () => void;
  readonly stopNarration: () => void;
  /** Starts background music: one URL loops, several shuffle; no-op while playing. */
  readonly startBgm: (urls: readonly string[]) => void;
  /** Stops host BGM; the shared audio core calls it right before the dawn narration. */
  readonly stopBgm: () => void;
  readonly setBgmVolume: (volume: number) => void;
  readonly setGameAudioVolume: (volume: number) => void;
}

/** The platform playback primitives the Avalon player drives. */
export interface AvalonAudioPlaybackPort {
  playClip(clip: AudioClip): Promise<void>;
  preloadClips(clips: readonly AudioClip[]): void;
  stop(): void;
  startBgm(urls: readonly string[]): void;
  stopBgm(): void;
  setBgmVolume(volume: number): void;
  setGameAudioVolume(volume: number): void;
}

export class AvalonAudioPlayer implements AvalonAudioRuntime {
  readonly #audioService: AvalonAudioPlaybackPort;

  constructor(audioService: AvalonAudioPlaybackPort) {
    this.#audioService = audioService;
  }

  readonly playEffect = (audioKey: string, isEndAudio?: boolean): Promise<void> => {
    const clip = isEndAudio
      ? resolveAvalonEndingAudio(audioKey)
      : resolveAvalonBeginningAudio(audioKey);
    return this.#audioService.playClip(clip);
  };

  readonly preload = (): void => this.#audioService.preloadClips(getAvalonPreloadAudio());

  readonly stopNarration = (): void => this.#audioService.stop();

  readonly startBgm = (urls: readonly string[]): void => this.#audioService.startBgm(urls);

  readonly stopBgm = (): void => this.#audioService.stopBgm();

  readonly setBgmVolume = (volume: number): void => this.#audioService.setBgmVolume(volume);

  readonly setGameAudioVolume = (volume: number): void =>
    this.#audioService.setGameAudioVolume(volume);
}

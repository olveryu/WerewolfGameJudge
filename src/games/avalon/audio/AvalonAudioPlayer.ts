/**
 * 阿瓦隆第一晚播报播放器 — 对齐狼人杀 WerewolfAudioPlayer。
 * 语义层，实际播放走平台 AudioService。
 */

import type { AudioService } from '@/services/infra/AudioService';

import {
  getAvalonPreloadAudio,
  resolveAvalonBeginningAudio,
  resolveAvalonEndingAudio,
} from './avalonAudioRegistry';

export interface AvalonAudioRuntime {
  readonly playEffect: (audioKey: string, isEndAudio?: boolean) => Promise<void>;
  readonly preload: () => Promise<void>;
  readonly stopNarration: () => void;
}

export class AvalonAudioPlayer implements AvalonAudioRuntime {
  readonly #audioService: AudioService;

  constructor(audioService: AudioService) {
    this.#audioService = audioService;
  }

  readonly playEffect = (audioKey: string, isEndAudio?: boolean): Promise<void> => {
    const clip = isEndAudio
      ? resolveAvalonEndingAudio(audioKey)
      : resolveAvalonBeginningAudio(audioKey);
    return this.#audioService.playClip(clip);
  };

  readonly preload = (): Promise<void> => this.#audioService.preloadClips(getAvalonPreloadAudio());

  readonly stopNarration = (): void => this.#audioService.stop();
}

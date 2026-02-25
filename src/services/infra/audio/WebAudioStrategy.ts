/**
 * WebAudioStrategy — HTML Audio playback for Web platform.
 *
 * Reuses a single `Audio` element (iOS Safari requires user-gesture-created
 * Audio for autoplay across multiple sources). Handles timeout fallback and
 * visibility-change pause/resume. Preloads via `audio.preload = 'auto'`.
 * No expo-audio dependency.
 */

import { audioLog } from '@/utils/logger';

import type { AudioAsset, AudioPlaybackStrategy } from './types';
import { AUDIO_TIMEOUT_MS, audioAssetToUrl } from './types';

export class WebAudioStrategy implements AudioPlaybackStrategy {
  #audioElement: HTMLAudioElement | null = null;
  #isPlaying = false;
  #resolve: (() => void) | null = null;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;

  #preloadedAudios: Map<string, HTMLAudioElement> = new Map();

  // ---------------------------------------------------------------------------
  // Shared settle helper — clears timeout, flips flag, resolves promise.
  // Replaces 6 duplicated cleanup blocks from the original monolith.
  // ---------------------------------------------------------------------------

  #settle(): void {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    this.#isPlaying = false;
    if (this.#resolve) {
      this.#resolve();
      this.#resolve = null;
    }
  }

  // ---------------------------------------------------------------------------
  // AudioPlaybackStrategy
  // ---------------------------------------------------------------------------

  async play(asset: AudioAsset, label: string): Promise<void> {
    audioLog.debug(`[${label}] [WEB] starting playback`);

    return new Promise<void>((resolve) => {
      try {
        this.#resolve = resolve;

        // Stop any current playback
        if (this.#audioElement) {
          this.#audioElement.pause();
          this.#audioElement.onended = null;
          this.#audioElement.onerror = null;
        }
        if (this.#timeoutId) {
          clearTimeout(this.#timeoutId);
          this.#timeoutId = null;
        }

        const audioUrl = audioAssetToUrl(asset);
        audioLog.debug(`[${label}] [WEB] audioUrl=${audioUrl}`);

        // Create or reuse Audio element (iOS Safari gesture authorization)
        if (!this.#audioElement) {
          audioLog.debug(`[${label}] [WEB] creating new Audio element`);
          this.#audioElement = new Audio();
        }

        const audio = this.#audioElement;
        this.#isPlaying = true;

        audio.onended = () => {
          audioLog.debug(`[${label}] [WEB] onended fired`);
          this.#settle();
        };

        audio.onerror = () => {
          audioLog.warn(`[WEB] Audio error for ${label}`);
          this.#settle();
        };

        // Timeout fallback
        this.#timeoutId = setTimeout(() => {
          audioLog.warn(`[WEB] Playback timeout for ${label}`);
          audio.pause();
          this.#settle();
        }, AUDIO_TIMEOUT_MS);

        audio.src = audioUrl;
        audioLog.debug(`[${label}] [WEB] calling audio.play()`);

        audio
          .play()
          .then(() => {
            audioLog.debug(`[${label}] [WEB] play() promise resolved`);
          })
          .catch((err) => {
            audioLog.warn(`[WEB] play() failed for ${label}:`, err);
            this.#settle();
          });
      } catch (error) {
        audioLog.warn(`[WEB] Audio playback failed for ${label}:`, error);
        this.#isPlaying = false;
        resolve();
      }
    });
  }

  stop(): void {
    if (this.#audioElement) {
      audioLog.debug('WebAudioStrategy.stop: pausing audio element (keeping for reuse)');
      try {
        this.#audioElement.pause();
        this.#audioElement.onended = null;
        this.#audioElement.onerror = null;
      } catch (e) {
        audioLog.warn('WebAudioStrategy.stop: error pausing', e);
      }
    }
    this.#settle();
  }

  getIsPlaying(): boolean {
    return this.#isPlaying;
  }

  pause(): void {
    if (this.#audioElement) {
      try {
        this.#audioElement.pause();
      } catch (e) {
        audioLog.warn('[visibility] error pausing web audio', e);
      }
    }
  }

  resume(): void {
    if (this.#isPlaying && this.#audioElement) {
      this.#audioElement.play().catch((e) => {
        audioLog.warn('[visibility] error resuming web audio', e);
      });
      audioLog.debug('[visibility] resumed web audio');
    }
  }

  async preloadFile(key: string, asset: AudioAsset): Promise<void> {
    if (typeof document === 'undefined') return;
    if (this.#preloadedAudios.has(key)) return;

    const audioUrl = audioAssetToUrl(asset);
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;
    audio.load();
    this.#preloadedAudios.set(key, audio);
  }

  clearPreloaded(): void {
    // Web: just clear references, browser GC handles the rest
    this.#preloadedAudios.clear();
    audioLog.debug('WebAudioStrategy: preloaded audio cleared');
  }

  cleanup(): void {
    this.stop();
    this.clearPreloaded();
  }
}

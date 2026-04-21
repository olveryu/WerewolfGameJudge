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
import { getUnlockedAudioElement } from './webAudioUnlock';

export class WebAudioStrategy implements AudioPlaybackStrategy {
  #audioElement: HTMLAudioElement | null = null;
  #isPlaying = false;
  #volume = 1.0;
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
    audioLog.debug('WEB starting playback', { label });

    return new Promise<void>((resolve) => {
      try {
        // Settle any in-flight promise before overwriting (prevents orphaned promises)
        this.#settle();

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
        audioLog.debug('WEB audioUrl resolved', { label, audioUrl });

        // Reuse gesture-authorized Audio element from webAudioUnlock, or create new.
        // The unlocked element was created inside a user gesture handler,
        // so subsequent src swaps + play() don't require a fresh gesture.
        if (!this.#audioElement) {
          this.#audioElement = getUnlockedAudioElement() ?? new Audio();
          audioLog.debug('WEB audio element acquired', {
            label,
            fromUnlock: this.#audioElement === getUnlockedAudioElement(),
          });
        }

        const audio = this.#audioElement;
        this.#isPlaying = true;

        audio.onended = () => {
          audioLog.debug('WEB onended fired', { label });
          this.#settle();
        };

        audio.onerror = () => {
          audioLog.warn('WEB Audio error', { label });
          this.#settle();
        };

        // Timeout fallback
        this.#timeoutId = setTimeout(() => {
          audioLog.warn('WEB Playback timeout', { label });
          audio.pause();
          this.#settle();
        }, AUDIO_TIMEOUT_MS);

        audio.volume = this.#volume;
        audio.src = audioUrl;
        audioLog.debug('WEB calling audio.play()', { label });

        audio
          .play()
          .then(() => {
            audioLog.debug('WEB play() promise resolved', { label });
          })
          .catch((err) => {
            audioLog.warn('WEB play() failed', { label }, err);
            this.#settle();
          });
      } catch (error) {
        audioLog.warn('WEB Audio playback failed', { label }, error);
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
        audioLog.warn('error pausing web audio', e);
      }
    }
  }

  resume(): void {
    if (this.#isPlaying && this.#audioElement) {
      this.#audioElement.play().catch((e) => {
        audioLog.warn('error resuming web audio', e);
      });
      audioLog.debug('resumed web audio');
    }
  }

  setVolume(volume: number): void {
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#audioElement) {
      this.#audioElement.volume = this.#volume;
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

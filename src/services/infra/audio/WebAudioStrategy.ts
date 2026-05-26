/**
 * WebAudioStrategy — Web platform audio playback strategy.
 *
 * Responsibilities:
 * - Implements the AudioPlaybackStrategy interface (HTML Audio backend)
 * - Reuses a single Audio element (iOS Safari requires gesture-created Audio for cross-src autoplay)
 * - Waits for `canplaythrough` before calling play(), ensuring full buffering
 * - Resets src on load errors so the browser retries when network recovers
 *
 * Not responsible for:
 * - Native platform playback (handled by NativeAudioStrategy)
 * - Playback ordering / orchestration logic
 *
 * Boundary constraints:
 * - No expo-audio dependency
 * - No manual timeout — relies on browser native retry mechanism
 * - Eliminates "streaming stall" issues (partially buffered audio never firing `ended`)
 */

import { audioLog } from '@/utils/logger';

import type { AudioAsset, AudioPlaybackStrategy } from './types';
import { audioAssetToUrl } from './types';
import { getUnlockedAudioElement } from './webAudioUnlock';

/**
 * Delay before resetting audio.src after a load error.
 * Gives the network a moment to recover before the browser re-fetches.
 */
const LOAD_RETRY_DELAY_MS = 2000;

/**
 * WebAudioStrategy — HTMLAudioElement implementation.
 *
 * Used for web-side TTS audio playback, with preloading, load-failure retry, and visibility pause/resume.
 */
export class WebAudioStrategy implements AudioPlaybackStrategy {
  #audioElement: HTMLAudioElement | null = null;
  #isPlaying = false;
  #volume = 1.0;
  #resolve: (() => void) | null = null;
  /** Whether playback was externally aborted via stop(). */
  #aborted = false;

  #preloadedAudios: Map<string, HTMLAudioElement> = new Map();

  // ---------------------------------------------------------------------------
  // Shared settle helper — flips flag, resolves promise.
  // ---------------------------------------------------------------------------

  #settle(): void {
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

    // Settle any in-flight promise before starting new playback
    this.#settle();

    // Stop any current playback
    if (this.#audioElement) {
      this.#audioElement.pause();
      this.#audioElement.onended = null;
      this.#audioElement.onerror = null;
      this.#audioElement.oncanplaythrough = null;
    }

    const audioUrl = audioAssetToUrl(asset);
    audioLog.debug('WEB audioUrl resolved', { label, audioUrl });

    // Reuse gesture-authorized Audio element from webAudioUnlock, or create new.
    if (!this.#audioElement) {
      this.#audioElement = getUnlockedAudioElement() ?? new Audio();
      audioLog.debug('WEB audio element acquired', {
        label,
        fromUnlock: this.#audioElement === getUnlockedAudioElement(),
      });
    }

    const audio = this.#audioElement;
    this.#isPlaying = true;
    this.#aborted = false;

    audio.volume = this.#volume;
    audio.src = audioUrl;

    // Wait for data to be fully buffered, then play.
    await this.#waitForCanPlayThrough(audio, audioUrl, label);

    // If stop() was called while waiting for load, bail out.
    if (this.#aborted) {
      this.#settle();
      return;
    }

    // Data is local — play() will not stall and onended will fire reliably.
    await this.#playAndWaitForEnd(audio, label);
  }

  /**
   * Wait until the audio element has enough data buffered to play through
   * without interruption. If a network error occurs during loading, reset
   * src after a delay to let the browser retry (the browser's internal
   * fetch resumes automatically when network recovers for stalls, but
   * fires `error` when the connection fully drops).
   *
   * Resolves when `canplaythrough` fires. Never rejects — waits indefinitely
   * (correct behavior: audio must play before game can proceed).
   */
  #waitForCanPlayThrough(audio: HTMLAudioElement, audioUrl: string, label: string): Promise<void> {
    // Already buffered enough (e.g. from preload or browser cache)
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      audioLog.debug('WEB already buffered', { label, readyState: audio.readyState });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const onReady = () => {
        cleanup();
        audioLog.debug('WEB canplaythrough fired', { label });
        resolve();
      };

      const onError = () => {
        // Network error during loading. Reset src after a delay to trigger
        // a fresh fetch attempt. The browser won't retry on its own after
        // a hard error — we must re-assign src.
        audioLog.warn('WEB load error, will retry', {
          label,
          errorCode: audio.error?.code,
          errorMessage: audio.error?.message,
        });

        // If aborted externally, don't retry.
        if (this.#aborted) {
          cleanup();
          resolve();
          return;
        }

        setTimeout(() => {
          if (this.#aborted) {
            cleanup();
            resolve();
            return;
          }
          audioLog.debug('WEB resetting src for retry', { label });
          audio.src = audioUrl;
          audio.load();
        }, LOAD_RETRY_DELAY_MS);
      };

      const cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
      };

      audio.oncanplaythrough = onReady;
      audio.onerror = onError;
      audio.load();
    });
  }

  /**
   * Call play() and wait for `ended`. At this point data is fully buffered,
   * so play() must succeed (gesture already authorized via webAudioUnlock)
   * and `ended` will fire reliably.
   *
   * If play() rejects (autoplay policy), that means webAudioUnlock failed —
   * throw to fail fast.
   */
  #playAndWaitForEnd(audio: HTMLAudioElement, label: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.#resolve = resolve;

      audio.onended = () => {
        audioLog.debug('WEB onended fired', { label });
        audio.onended = null;
        audio.onerror = null;
        this.#settle();
      };

      audio.onerror = () => {
        // Should not happen after canplaythrough — data is local.
        // If it does, treat as a fatal bug in the audio subsystem.
        const msg = `WEB playback error after canplaythrough: ${audio.error?.message ?? 'unknown'}`;
        audioLog.error(msg, { label, errorCode: audio.error?.code });
        audio.onended = null;
        audio.onerror = null;
        this.#settle();
      };

      audioLog.debug('WEB calling audio.play()', { label });

      audio.play().then(
        () => {
          audioLog.debug('WEB play() promise resolved', { label });
        },
        (err: unknown) => {
          // play() rejected = autoplay policy blocked.
          // webAudioUnlock should have prevented this. Fail fast.
          audio.onended = null;
          audio.onerror = null;
          this.#isPlaying = false;
          this.#resolve = null;
          throw new Error(
            `WEB play() rejected (webAudioUnlock broken): ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      );
    });
  }

  stop(): void {
    this.#aborted = true;
    if (this.#audioElement) {
      audioLog.debug('WebAudioStrategy.stop: pausing audio element (keeping for reuse)');
      try {
        this.#audioElement.pause();
        this.#audioElement.onended = null;
        this.#audioElement.onerror = null;
        this.#audioElement.oncanplaythrough = null;
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

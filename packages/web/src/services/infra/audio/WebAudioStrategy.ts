/**
 * WebAudioStrategy — HTML Audio playback for foreground game audio.
 *
 * Responsibilities:
 * - Reuses a single Audio element (iOS Safari requires gesture-created Audio for cross-src autoplay)
 * - Waits for `canplaythrough` before calling play(), ensuring full buffering
 * - Retries load errors within a bounded buffering deadline
 *
 * Not responsible for:
 * - Playback ordering / orchestration logic
 *
 * Boundary constraints:
 * - Every load/play/stop path settles its Promise exactly once
 * - Eliminates "streaming stall" issues (partially buffered audio never firing `ended`)
 */

import { audioLog } from '@/utils/logger';

import { getUnlockedAudioElement } from './webAudioUnlock';

/** Maximum time to buffer Web narration before reporting a load failure. */
export const WEB_AUDIO_LOAD_TIMEOUT_MS = 15000;

/**
 * Delay before resetting audio.src after a load error.
 * Gives the network a moment to recover before the browser re-fetches.
 */
const LOAD_RETRY_DELAY_MS = 2000;

/** HTMLAudioElement player with preloading, load-failure retry, and visibility pause/resume. */
export class WebAudioStrategy {
  #audioElement: HTMLAudioElement | null = null;
  #volume = 1;
  #loadAbortController: AbortController | null = null;
  #cancelPlayback: (() => void) | null = null;

  readonly #preloadedAudios = new Map<string, HTMLAudioElement>();

  /** Play `url` and settle when playback completes, is cancelled, or fails. */
  async play(url: string, label: string): Promise<void> {
    audioLog.debug('WEB starting playback', { label, url });

    this.stop();

    // Reuse gesture-authorized Audio element from webAudioUnlock, or create new.
    if (!this.#audioElement) {
      this.#audioElement = getUnlockedAudioElement() ?? new Audio();
      audioLog.debug('WEB audio element acquired', {
        label,
        fromUnlock: this.#audioElement === getUnlockedAudioElement(),
      });
    }

    const audio = this.#audioElement;
    audio.volume = this.#volume;
    const loadAbortController = new AbortController();
    this.#loadAbortController = loadAbortController;

    audio.src = url;

    try {
      await this.#waitForCanPlayThrough(audio, url, label, loadAbortController.signal);
    } catch (error) {
      if (this.#loadAbortController === loadAbortController) {
        this.stop();
      }
      throw error;
    }
    if (this.#loadAbortController === loadAbortController) {
      this.#loadAbortController = null;
    }
    if (loadAbortController.signal.aborted) return;

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
   * Resolves when `canplaythrough` fires or cancellation is requested.
   * Rejects after the bounded buffering deadline so orchestration can report
   * the failure and release the authoritative audio gate.
   */
  #waitForCanPlayThrough(
    audio: HTMLAudioElement,
    url: string,
    label: string,
    signal: AbortSignal,
  ): Promise<void> {
    // Already buffered enough (e.g. from preload or browser cache)
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      audioLog.debug('WEB already buffered', { label, readyState: audio.readyState });
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let loadTimeout: ReturnType<typeof setTimeout> | null = null;
      let isSettled = false;

      function cleanup(): void {
        if (retryTimer !== null) clearTimeout(retryTimer);
        if (loadTimeout !== null) clearTimeout(loadTimeout);
        signal.removeEventListener('abort', onAbort);
        audio.oncanplaythrough = null;
        audio.onerror = null;
      }

      function settle(error?: Error): void {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }

      function onAbort(): void {
        settle();
      }

      const onReady = (): void => {
        audioLog.debug('WEB canplaythrough fired', { label });
        settle();
      };

      const onError = (): void => {
        if (retryTimer !== null) return;

        // The browser won't retry on its own after a hard error — we must re-assign src.
        audioLog.warn('WEB load error, will retry', {
          label,
          errorCode: audio.error?.code,
          errorMessage: audio.error?.message,
        });

        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (signal.aborted) return;
          audioLog.debug('WEB resetting src for retry', { label });
          audio.src = url;
          audio.load();
        }, LOAD_RETRY_DELAY_MS);
      };

      audio.oncanplaythrough = onReady;
      audio.onerror = onError;
      if (signal.aborted) {
        settle();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      loadTimeout = setTimeout(() => {
        settle(
          new Error(`WEB audio load timed out after ${WEB_AUDIO_LOAD_TIMEOUT_MS}ms: ${label}`),
        );
      }, WEB_AUDIO_LOAD_TIMEOUT_MS);
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
    return new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const settle = (error?: Error): void => {
        if (isSettled) return;
        isSettled = true;
        audio.onended = null;
        audio.onerror = null;
        if (this.#cancelPlayback === cancelPlayback) this.#cancelPlayback = null;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const cancelPlayback = (): void => settle();
      this.#cancelPlayback = cancelPlayback;

      audio.onended = () => {
        audioLog.debug('WEB onended fired', { label });
        settle();
      };

      audio.onerror = () => {
        // Data is local after canplaythrough, so an error here is a fatal audio-subsystem bug.
        const msg = `WEB playback error after canplaythrough: ${audio.error?.message ?? 'unknown'}`;
        audioLog.error(msg, { label, errorCode: audio.error?.code });
        settle(new Error(msg));
      };

      audioLog.debug('WEB calling audio.play()', { label });

      audio.play().then(
        () => {
          audioLog.debug('WEB play() promise resolved', { label });
        },
        (err: unknown) => {
          settle(
            new Error(
              `WEB play() rejected (webAudioUnlock broken): ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        },
      );
    });
  }

  /** Stop current playback and settle any pending promise. */
  stop(): void {
    this.#loadAbortController?.abort();
    this.#loadAbortController = null;
    this.#cancelPlayback?.();
    this.#cancelPlayback = null;
    if (this.#audioElement) {
      audioLog.debug('WebAudioStrategy.stop: pausing audio element (keeping for reuse)');
      try {
        this.#audioElement.pause();
        this.#audioElement.onended = null;
        this.#audioElement.onerror = null;
        this.#audioElement.oncanplaythrough = null;
        this.#audioElement.removeAttribute('src');
        this.#audioElement.load();
      } catch (e) {
        audioLog.warn('WebAudioStrategy.stop: error pausing', e);
      }
    }
  }

  /** Pause current playback (for visibility change). */
  pause(): void {
    if (this.#audioElement) {
      try {
        this.#audioElement.pause();
      } catch (e) {
        audioLog.warn('error pausing web audio', e);
      }
    }
  }

  /** Resume playback if it was active before pause. */
  resume(): void {
    if (this.#cancelPlayback && this.#audioElement) {
      this.#audioElement.play().catch((e: unknown) => {
        audioLog.warn('error resuming web audio', e);
      });
      audioLog.debug('resumed web audio');
    }
  }

  /** Playback volume (0.0–1.0), applied to the current element and every later play. */
  setVolume(volume: number): void {
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#audioElement) {
      this.#audioElement.volume = this.#volume;
    }
  }

  /** Start buffering one audio file for a faster first play. */
  preloadFile(key: string, url: string): void {
    if (this.#preloadedAudios.has(key)) return;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    this.#preloadedAudios.set(key, audio);
  }

  /** Release the preloaded elements; the browser GC handles the rest. */
  clearPreloaded(): void {
    this.#preloadedAudios.clear();
    audioLog.debug('WebAudioStrategy: preloaded audio cleared');
  }
}

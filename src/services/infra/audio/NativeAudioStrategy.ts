/**
 * NativeAudioStrategy — expo-audio playback for iOS / Android.
 *
 * Creates a new `AudioPlayer` per playback (iOS requires fresh players for
 * reliable event delivery). Tracks stale players for deferred `remove()` to
 * prevent native resource leaks. Preloads by creating players that keep decoded
 * audio in memory. No HTML Audio dependency.
 */

import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { createAudioPlayer } from 'expo-audio';

import { audioLog } from '@/utils/logger';

import type { AudioAsset, AudioPlaybackStrategy } from './types';
import { AUDIO_TIMEOUT_MS } from './types';

const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

export class NativeAudioStrategy implements AudioPlaybackStrategy {
  #player: AudioPlayer | null = null;
  #subscription: ReturnType<AudioPlayer['addListener']> | null = null;
  #isPlaying = false;
  #resolve: (() => void) | null = null;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #label = 'audio';
  #statusCount = 0;

  #preloadedPlayers: Map<string, AudioPlayer> = new Map();
  // Old native players kept alive (paused) to avoid event-delivery issues.
  // Released in cleanup() / clearPreloaded().
  #staleNativePlayers: Set<AudioPlayer> = new Set();

  // ---------------------------------------------------------------------------
  // Shared settle helper — clears timeout, flips flag, resolves promise.
  // ---------------------------------------------------------------------------

  #settle(): void {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    this.#isPlaying = false;
    if (this.#resolve) {
      audioLog.debug(`[${this.#label}] settle, statusCount=${this.#statusCount}`);
      this.#resolve();
      this.#resolve = null;
    }
  }

  // ---------------------------------------------------------------------------
  // AudioPlaybackStrategy
  // ---------------------------------------------------------------------------

  async play(asset: AudioAsset, label: string): Promise<void> {
    try {
      // Stop current playback and settle any pending promise
      this.stop();

      // Remove old listener
      if (this.#subscription) {
        try {
          this.#subscription.remove();
        } catch {
          // Ignore
        }
        this.#subscription = null;
      }

      audioLog.debug(`[${label}] creating player and starting playback`);
      const player = createAudioPlayer(asset);

      // Track old player for deferred cleanup (stale but not removed to avoid event issues)
      if (this.#player) {
        this.#staleNativePlayers.add(this.#player);
      }
      this.#player = player;
      audioLog.debug(`[${label}] player created OK`);

      this.#subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) =>
        this.#handlePlaybackStatus(status),
      );
      audioLog.debug(`[${label}] listener added`);

      this.#isPlaying = true;

      return new Promise<void>((resolve) => {
        this.#resolve = resolve;
        this.#label = label;
        this.#statusCount = 0;

        // Timeout fallback — resolve after max time even if audio didn't finish
        this.#timeoutId = setTimeout(() => {
          audioLog.debug(
            `[${label}] TIMEOUT after ${AUDIO_TIMEOUT_MS}ms, statusCount=${this.#statusCount}`,
          );
          if (isJest) {
            audioLog.debug(' Playback timeout - proceeding without waiting for completion');
          } else {
            audioLog.warn(' Playback timeout - proceeding without waiting for completion');
          }
          this.#settle();
        }, AUDIO_TIMEOUT_MS);

        audioLog.debug(`[${label}] calling player.play()`);
        player.play();
        audioLog.debug(`[${label}] player.play() returned`);
      });
    } catch (error) {
      audioLog.warn(`[${label}] Audio playback failed, resolving anyway:`, error);
      this.#isPlaying = false;
      return;
    }
  }

  #handlePlaybackStatus(status: AudioStatus): void {
    this.#statusCount++;
    const label = this.#label;
    audioLog.debug(
      `[${label}] status #${this.#statusCount}: playing=${status.playing} loaded=${status.isLoaded} duration=${status.duration} didJustFinish=${status.didJustFinish}`,
    );

    try {
      if (status.isLoaded && status.duration === 0) {
        audioLog.warn(' Audio duration is 0 - may be invalid, waiting for timeout fallback');
      }
      if (status.didJustFinish) {
        audioLog.debug(`[${label}] didJustFinish=true, calling settle`);
        this.#settle();
      }
    } catch {
      audioLog.warn(' Error in playback status listener - resolving');
      this.#settle();
    }
  }

  stop(): void {
    if (this.#resolve) {
      audioLog.debug('[stopCurrentPlayer] resolving pending playback');
    }

    if (this.#player) {
      audioLog.debug('NativeAudioStrategy.stop: pausing current player (keeping for reuse)');
      try {
        this.#player.pause();
      } catch (e) {
        audioLog.warn('NativeAudioStrategy.stop: error pausing player', e);
      }
    } else {
      audioLog.debug('NativeAudioStrategy.stop: no player to stop');
    }

    this.#settle();
  }

  getIsPlaying(): boolean {
    return this.#isPlaying;
  }

  pause(): void {
    if (this.#player) {
      try {
        this.#player.pause();
      } catch (e) {
        audioLog.warn('[visibility] error pausing player', e);
      }
    }
  }

  resume(): void {
    if (this.#isPlaying && this.#player) {
      try {
        this.#player.play();
        audioLog.debug('[visibility] resumed main audio');
      } catch (e) {
        audioLog.warn('[visibility] error resuming player', e);
      }
    }
  }

  async preloadFile(key: string, asset: AudioAsset): Promise<void> {
    if (isJest) return;
    if (this.#preloadedPlayers.has(key)) return;
    const player = createAudioPlayer(asset);
    this.#preloadedPlayers.set(key, player);
  }

  clearPreloaded(): void {
    for (const player of this.#preloadedPlayers.values()) {
      try {
        player.remove();
      } catch {
        // ignore
      }
    }
    this.#preloadedPlayers.clear();
    this.#releaseStaleNativePlayers();
    audioLog.debug('NativeAudioStrategy: preloaded + stale players released');
  }

  cleanup(): void {
    this.stop();

    if (this.#subscription) {
      try {
        this.#subscription.remove();
      } catch {
        // ignore
      }
      this.#subscription = null;
    }

    this.clearPreloaded();
  }

  /** Release old native AudioPlayers kept alive to avoid event-delivery issues. */
  #releaseStaleNativePlayers(): void {
    if (this.#staleNativePlayers.size === 0) return;
    audioLog.debug(`releasing ${this.#staleNativePlayers.size} stale native players`);
    for (const p of this.#staleNativePlayers) {
      try {
        p.remove();
      } catch {
        // ignore — player may already be released
      }
    }
    this.#staleNativePlayers.clear();
  }
}

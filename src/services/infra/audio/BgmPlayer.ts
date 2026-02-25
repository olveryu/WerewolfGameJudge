/**
 * BgmPlayer — background music lifecycle manager.
 *
 * Handles loop playback of night BGM with platform-specific backends
 * (HTML Audio on Web, expo-audio on Native). Supports pause/resume for
 * visibility changes. Independent of TTS playback — AudioService composes both.
 */

import type { AudioPlayer } from 'expo-audio';
import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { audioLog } from '@/utils/logger';

import { BGM_NIGHT, BGM_VOLUME } from './audioRegistry';
import { audioAssetToUrl } from './types';

const isWeb = Platform.OS === 'web';

export class BgmPlayer {
  #nativePlayer: AudioPlayer | null = null;
  #webElement: HTMLAudioElement | null = null;
  #isPlaying = false;

  getIsBgmPlaying(): boolean {
    return this.#isPlaying;
  }

  async start(): Promise<void> {
    if (this.#isPlaying || this.#nativePlayer || this.#webElement) {
      audioLog.debug('BGM already playing, skipping');
      return;
    }

    try {
      audioLog.debug('Starting BGM...');

      if (isWeb && typeof document !== 'undefined') {
        const audioUrl = audioAssetToUrl(BGM_NIGHT);
        const audio = new Audio(audioUrl);
        audio.volume = BGM_VOLUME;
        audio.loop = true;
        this.#webElement = audio;
        this.#isPlaying = true;
        audio.play().catch((err) => {
          audioLog.warn('Web BGM play() rejected (autoplay policy?):', err);
          this.#isPlaying = false;
        });
        audioLog.debug('BGM started successfully (Web HTML Audio)');
        return;
      }

      // Native: use expo-audio player
      const player = createAudioPlayer(BGM_NIGHT);
      this.#nativePlayer = player;
      this.#isPlaying = true;
      player.volume = BGM_VOLUME;
      player.loop = true;
      player.play();
      audioLog.debug('BGM started successfully');
    } catch (error) {
      audioLog.warn('Failed to start BGM:', error);
      this.#isPlaying = false;
      this.#nativePlayer = null;
      this.#webElement = null;
    }
  }

  stop(): void {
    if (this.#webElement) {
      try {
        this.#webElement.pause();
        this.#webElement.src = '';
      } catch {
        // Ignore errors
      }
      this.#webElement = null;
      this.#isPlaying = false;
      audioLog.debug('BGM stopped (Web)');
    }
    if (this.#nativePlayer) {
      try {
        this.#nativePlayer.pause();
        this.#nativePlayer.remove();
      } catch {
        // Ignore errors
      }
      this.#nativePlayer = null;
      this.#isPlaying = false;
      audioLog.debug('BGM stopped');
    }
  }

  pause(): void {
    if (this.#webElement) {
      try {
        this.#webElement.pause();
      } catch (e) {
        audioLog.warn('[visibility] error pausing web bgm', e);
      }
    } else if (this.#nativePlayer) {
      try {
        this.#nativePlayer.pause();
      } catch (e) {
        audioLog.warn('[visibility] error pausing bgm', e);
      }
    }
  }

  resume(): void {
    if (!this.#isPlaying) return;
    if (this.#webElement) {
      this.#webElement.play().catch((e) => {
        audioLog.warn('[visibility] error resuming web bgm', e);
      });
      audioLog.debug('[visibility] resumed web BGM');
    } else if (this.#nativePlayer) {
      try {
        this.#nativePlayer.play();
        audioLog.debug('[visibility] resumed BGM');
      } catch (e) {
        audioLog.warn('[visibility] error resuming bgm', e);
      }
    }
  }
}

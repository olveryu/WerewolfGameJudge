/**
 * AudioService — audio playback engine (composition root).
 *
 * Delegates platform-specific foreground playback to AudioPlaybackStrategy,
 * delegates BGM lifecycle to BgmPlayer, exposes a unified public API.
 */
import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { handleError } from '@/utils/errorPipeline';
import { audioLog } from '@/utils/logger';

import { BgmPlayer } from './audio/BgmPlayer';
import { NativeAudioStrategy } from './audio/NativeAudioStrategy';
import type { AudioAsset, AudioClip, AudioPlaybackStrategy } from './audio/types';
import { WebAudioStrategy } from './audio/WebAudioStrategy';
import { setupWebAudioUnlock } from './audio/webAudioUnlock';

const isWeb = Platform.OS === 'web';

/**
 * AudioService — audio playback engine (composition root).
 *
 * Responsibilities:
 * - Delegate platform-specific foreground playback to AudioPlaybackStrategy
 * - Delegate BGM lifecycle to BgmPlayer
 * - Provide playback primitives for game-owned runtime orchestration
 * - Manage pause/resume on Web visibility change
 *
 * Not responsible for:
 * - Deciding "when to play what" (declared by handlers, orchestrated by a game runtime)
 * - Game logic or state management
 *
 * Boundary constraints:
 * - Synchronously register the Web gesture unlock listener at construction; must not sit behind an `await`
 * - Web depends on setupWebAudioUnlock() being called synchronously in the constructor
 */
export class AudioService {
  readonly #strategy: AudioPlaybackStrategy;
  readonly #bgm: BgmPlayer;
  #visibilityHandler: (() => void) | null = null;

  constructor() {
    this.#strategy = isWeb ? new WebAudioStrategy() : new NativeAudioStrategy();
    this.#bgm = new BgmPlayer();

    // Web: Register gesture listeners synchronously so the very first user
    // interaction unlocks AudioContext + HTMLAudioElement.  Must NOT sit behind
    // an `await` — otherwise listeners are registered too late and the unlock
    // never fires.  See webAudioUnlock.ts for details.
    if (isWeb) {
      setupWebAudioUnlock();
    }

    // Fire-and-forget: initializes audio mode + Web visibility handler
    void this.#initAudio();
  }

  async #initAudio(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false, // Stop when app goes to background
        interruptionMode: 'duckOthers',
      });

      // Web: Listen for visibility change to pause/resume audio
      if (typeof document !== 'undefined') {
        this.#visibilityHandler = () => {
          if (document.hidden) {
            audioLog.debug('page hidden, pausing all audio');
            this.#strategy.pause();
            this.#bgm.pause();
          } else {
            audioLog.debug('page visible, resuming audio');
            this.#strategy.resume();
            this.#bgm.resume();
          }
        };
        document.addEventListener('visibilitychange', this.#visibilityHandler);
      }
    } catch (error) {
      handleError(error, { label: '音频初始化', logger: audioLog, feedback: false });
    }
  }

  // ============ Foreground audio ============

  async playClip(clip: AudioClip): Promise<void> {
    return this.#strategy.play(clip.asset, clip.key);
  }

  // ============ Playback control ============

  stop(): void {
    this.#strategy.stop();
  }

  getIsPlaying(): boolean {
    return this.#strategy.getIsPlaying();
  }

  cleanup(): void {
    audioLog.debug('cleanup: stopping all audio');
    this.#strategy.cleanup();
    this.#bgm.stop();
    // Remove visibilitychange listener if registered (web only)
    if (this.#visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
  }

  // ============ BGM ============

  async startBgm(assets: AudioAsset[]): Promise<void> {
    return this.#bgm.start(assets);
  }

  stopBgm(): void {
    this.#bgm.stop();
  }

  setBgmVolume(volume: number): void {
    this.#bgm.setVolume(volume);
  }

  setGameAudioVolume(volume: number): void {
    this.#strategy.setVolume(volume);
  }

  // ============ Preload ============

  async preloadClips(clips: readonly AudioClip[]): Promise<void> {
    audioLog.debug('preloadClips: starting', { count: clips.length });
    await Promise.all(clips.map((clip) => this.#strategy.preloadFile(clip.key, clip.asset)));
    audioLog.debug('preloadClips: done', { count: clips.length });
  }

  clearPreloaded(): void {
    this.#strategy.clearPreloaded();
  }
}

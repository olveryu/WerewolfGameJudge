/**
 * AudioService — audio playback engine for the web client.
 *
 * Responsibilities:
 * - Delegate foreground HTML Audio playback to WebAudioStrategy
 * - Delegate background music lifecycle to BgmPlayer
 * - Provide playback primitives for game-owned runtime orchestration
 * - Pause/resume both on page visibility change
 *
 * Not responsible for:
 * - Deciding "when to play what" (declared by handlers, orchestrated by a game runtime)
 * - Game logic or state management
 *
 * Boundary constraints:
 * - The gesture unlock listener registers synchronously at construction; it must not sit behind
 *   an `await`, otherwise the first interaction can pass before it exists (see webAudioUnlock).
 */
import type { AudioClip } from '@/features/product/model/AudioClip';
import { audioLog } from '@/utils/logger';

import { BgmPlayer } from './audio/BgmPlayer';
import { WebAudioStrategy } from './audio/WebAudioStrategy';
import { setupWebAudioUnlock } from './audio/webAudioUnlock';

/** One per page; created by the app composition root. */
export class AudioService {
  readonly #strategy = new WebAudioStrategy();
  readonly #bgm = new BgmPlayer();

  constructor() {
    setupWebAudioUnlock();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        audioLog.debug('page hidden, pausing all audio');
        this.#strategy.pause();
        this.#bgm.pause();
      } else {
        audioLog.debug('page visible, resuming audio');
        this.#strategy.resume();
        this.#bgm.resume();
      }
    });
  }

  /** Plays `clip`; settles when it finishes or is stopped, rejects on load/playback failure. */
  playClip(clip: AudioClip): Promise<void> {
    return this.#strategy.play(clip.url, clip.key);
  }

  /** Stops the current clip and settles its pending playback. */
  stop(): void {
    this.#strategy.stop();
  }

  /** Starts buffering `clips` so their first play does not wait on the network. */
  preloadClips(clips: readonly AudioClip[]): void {
    audioLog.debug('preloadClips', { count: clips.length });
    for (const clip of clips) this.#strategy.preloadFile(clip.key, clip.url);
  }

  /** Releases the preloaded clips. */
  clearPreloaded(): void {
    this.#strategy.clearPreloaded();
  }

  /** Foreground game audio volume (0.0–1.0). */
  setGameAudioVolume(volume: number): void {
    this.#strategy.setVolume(volume);
  }

  /** Starts background music: one URL loops, several play as a shuffled playlist. No-op while playing. */
  startBgm(urls: readonly string[]): void {
    this.#bgm.start(urls);
  }

  /** Stops background music; idempotent. */
  stopBgm(): void {
    this.#bgm.stop();
  }

  /** Whether background music is playing; the only source the UI reads. */
  readonly isBgmPlaying = (): boolean => this.#bgm.isPlaying();

  /** Notifies on every `isBgmPlaying()` change. */
  readonly subscribeBgm = (listener: () => void): (() => void) => this.#bgm.subscribe(listener);

  /** Background music volume (0.0–1.0), applied to the current track immediately. */
  setBgmVolume(volume: number): void {
    this.#bgm.setVolume(volume);
  }
}

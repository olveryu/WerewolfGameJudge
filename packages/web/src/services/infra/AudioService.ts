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

/** Playback owned by a settings preview, never by the active game. */
export interface AudioPreviewPlayback {
  playClip(clip: AudioClip): Promise<void>;
  stop(): void;
  startBgm(urls: readonly string[]): void;
  stopBgm(): void;
  readonly isBgmPlaying: () => boolean;
  readonly subscribeBgm: (listener: () => void) => () => void;
}

export class AudioPreviewUnavailableError extends Error {
  constructor() {
    super('游戏音频正在播放，暂时无法试听。');
    this.name = 'AudioPreviewUnavailableError';
  }
}

/** One per page; created by the app composition root. */
export class AudioService {
  readonly #strategy = new WebAudioStrategy();
  readonly #bgm = new BgmPlayer();
  readonly #gameOwner = {};
  readonly #previewOwner = {};
  #foreground: { readonly owner: object } | null = null;
  #bgmOwner: object | null = null;

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

  /** Plays `clip`; resolves on completion and rejects on stop, loading or playback failure. */
  playClip(clip: AudioClip): Promise<void> {
    return this.#playClip(clip, this.#gameOwner);
  }

  /** Stops the current clip and rejects its pending playback as cancelled. */
  stop(): void {
    this.#foreground = null;
    this.#strategy.stop();
  }

  #playClip(clip: AudioClip, owner: object): Promise<void> {
    if (owner === this.#previewOwner && this.#isGameAudioActive()) {
      return Promise.reject(new AudioPreviewUnavailableError());
    }
    if (owner === this.#gameOwner && this.#bgmOwner === this.#previewOwner) this.stopBgm();
    const playback = { owner };
    this.#foreground = playback;
    return this.#strategy.play(clip.url, clip.key).finally(() => {
      if (this.#foreground === playback) this.#foreground = null;
    });
  }

  #isGameAudioActive(): boolean {
    return (
      this.#foreground?.owner === this.#gameOwner ||
      (this.#bgmOwner === this.#gameOwner && this.#bgm.isPlaying())
    );
  }

  /** Gives settings a lease that cannot stop or replace audio owned by the game. */
  createPreviewPlayback(): AudioPreviewPlayback {
    return {
      playClip: (clip) => this.#playClip(clip, this.#previewOwner),
      stop: () => {
        if (this.#foreground?.owner === this.#previewOwner) this.stop();
      },
      startBgm: (urls) => {
        if (this.#isGameAudioActive()) throw new AudioPreviewUnavailableError();
        this.#bgmOwner = this.#previewOwner;
        this.#bgm.start(urls);
      },
      stopBgm: () => {
        if (this.#bgmOwner === this.#previewOwner) this.stopBgm();
      },
      isBgmPlaying: () => this.#bgmOwner === this.#previewOwner && this.#bgm.isPlaying(),
      subscribeBgm: this.subscribeBgm,
    };
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
    if (this.#foreground?.owner === this.#previewOwner) this.stop();
    if (this.#bgmOwner === this.#previewOwner) this.#bgm.stop();
    this.#bgmOwner = this.#gameOwner;
    this.#bgm.start(urls);
  }

  /** Stops background music; idempotent. */
  stopBgm(): void {
    this.#bgm.stop();
    this.#bgmOwner = null;
  }

  /** Whether the game's background music is playing; previews have their own view. */
  readonly isBgmPlaying = (): boolean =>
    this.#bgmOwner === this.#gameOwner && this.#bgm.isPlaying();

  /** Notifies on every `isBgmPlaying()` change. */
  readonly subscribeBgm = (listener: () => void): (() => void) => this.#bgm.subscribe(listener);

  /** Background music volume (0.0–1.0), applied to the current track immediately. */
  setBgmVolume(volume: number): void {
    this.#bgm.setVolume(volume);
  }
}

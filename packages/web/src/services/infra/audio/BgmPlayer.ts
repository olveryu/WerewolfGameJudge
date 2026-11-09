/**
 * BgmPlayer — background music lifecycle manager.
 *
 * Responsibilities:
 * - Single-track loop mode (user-selected BGM)
 * - Playlist mode (shuffle all tracks, sequential playback, re-shuffle on cycle)
 * - pause/resume on page visibility change
 *
 * Not responsible for:
 * - Foreground game audio playback (handled by WebAudioStrategy)
 * - Deciding when to play (orchestrated by the game's BGM control)
 *
 * Boundary constraints:
 * - Volume goes through a GainNode (iOS Safari ignores HTMLAudioElement.volume)
 * - AudioContext / GainNode / MediaElementAudioSourceNode / HTMLAudioElement
 *   are all reused across tracks — in WeChat web-view, creating `new Audio()` or
 *   AudioContext outside a user gesture is silently blocked
 * - WeChat web-view (HarmonyOS ArkWeb) may swallow the `ended` event and native `loop`;
 *   `timeupdate` polling detects track end as a fallback. #trackEndFired prevents a
 *   double fire from `ended` + `timeupdate`.
 */

import { shuffleArray } from '@game-judge/game-engine/platform/random';

import { BGM_VOLUME } from '@/features/product/model/BgmCatalog';
import { audioLog } from '@/utils/logger';

import { ensureAudioContextRunning, getAudioContext } from './AudioContextOwner';
import { getUnlockedBgmElement } from './webAudioUnlock';

/** Brief silence between playlist tracks so the listener notices the transition. */
const PLAYLIST_GAP_MS = 2000;

/** BGM player over one reused HTMLAudioElement routed through the shared AudioContext. */
export class BgmPlayer {
  #isPlaying = false;
  #playlist: string[] = [];
  #currentIndex = 0;
  #isPlaylist = false;
  #volume = BGM_VOLUME;
  #gapTimer: ReturnType<typeof setTimeout> | null = null;

  #element: HTMLAudioElement | null = null;
  #routing: { readonly context: AudioContext; readonly gain: GainNode } | null = null;
  // Held so the permanent element↔source binding is not garbage-collected.
  // eslint-disable-next-line no-unused-private-class-members
  #sourceNode: MediaElementAudioSourceNode | null = null;
  #endedHandler: (() => void) | null = null;
  #timeupdateHandler: (() => void) | null = null;
  #trackEndFired = false;

  /** Update BGM volume (0.0–1.0). Applies immediately to current playback. */
  setVolume(volume: number): void {
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#routing) {
      this.#routing.gain.gain.value = this.#volume;
    }
  }

  /**
   * Start BGM playback; a no-op while already playing.
   * @param urls - One URL = loop mode; several = playlist (shuffle + sequential).
   */
  start(urls: readonly string[]): void {
    if (this.#isPlaying) {
      audioLog.debug('BGM already playing, skipping');
      return;
    }
    if (urls.length === 0) {
      throw new Error('[FAIL-FAST] BGM start called without tracks');
    }

    this.#isPlaylist = urls.length > 1;
    this.#playlist = this.#isPlaylist ? shuffleArray([...urls]) : [...urls];
    this.#currentIndex = 0;
    this.#isPlaying = true;

    audioLog.debug('Starting BGM', {
      mode: this.#isPlaylist ? 'playlist' : 'loop',
      count: urls.length,
    });
    this.#playCurrentTrack();
  }

  /** Stops playback; the shared context and the element↔source binding stay alive for reuse. */
  stop(): void {
    this.#isPlaying = false;
    if (this.#gapTimer) {
      clearTimeout(this.#gapTimer);
      this.#gapTimer = null;
    }
    this.#releaseTrack();
    audioLog.debug('BGM stopped');
  }

  /** Pauses the current track (page hidden). */
  pause(): void {
    this.#element?.pause();
  }

  /** Resumes the current track (page visible again) if BGM is playing. */
  resume(): void {
    if (!this.#isPlaying || !this.#element) return;
    // Ensure shared context is running (covers WebKit suspended + interrupted).
    void ensureAudioContextRunning();
    this.#element.play().catch((e: unknown) => {
      audioLog.warn('error resuming web bgm', e);
    });
    audioLog.debug('resumed web BGM');
  }

  #playCurrentTrack(): void {
    if (!this.#isPlaying) return;

    const url = this.#playlist[this.#currentIndex];
    if (url === undefined) {
      throw new Error(`[FAIL-FAST] BGM playlist has no track at ${this.#currentIndex}`);
    }
    try {
      this.#playTrack(url, !this.#isPlaylist);
    } catch (error) {
      audioLog.warn('Failed to start BGM track', error);
      this.#isPlaying = false;
      this.#releaseTrack();
    }
  }

  /**
   * The GainNode routing on the shared AudioContext, created once. The context MUST exist by
   * the time BGM plays (the user already tapped in the room); null means the unlock never
   * fired, and creating an unauthorized context here would only play silently.
   */
  #acquireRouting(): { readonly context: AudioContext; readonly gain: GainNode } | null {
    if (this.#routing && this.#routing.context.state !== 'closed') return this.#routing;
    const context = getAudioContext();
    if (!context || context.state === 'closed') return null;
    const gain = context.createGain();
    gain.connect(context.destination);
    this.#routing = { context, gain };
    return this.#routing;
  }

  #playTrack(url: string, loop: boolean): void {
    const routing = this.#acquireRouting();
    if (!routing) {
      audioLog.error(
        'BgmPlayer: no shared AudioContext available — webAudioUnlock may not have fired',
      );
      this.#isPlaying = false;
      return;
    }

    // Fire-and-forget is safe because ensureAudioContextRunning never rejects.
    void ensureAudioContextRunning();
    routing.gain.gain.value = this.#volume;

    let audio = this.#element;
    if (!audio) {
      // Prefer the gesture-authorized element: Android WebView rejects play() on
      // elements created outside a user gesture.
      audio = getUnlockedBgmElement() ?? new Audio();
      audio.src = url;
      // createMediaElementSource binds an element permanently; a second call throws.
      const source = routing.context.createMediaElementSource(audio);
      source.connect(routing.gain);
      this.#element = audio;
      this.#sourceNode = source;
    } else {
      audio.src = url;
    }
    audio.loop = loop;
    this.#trackEndFired = false;
    this.#removeTrackListeners(audio);

    if (!loop) {
      this.#endedHandler = () => this.#handleTrackEnd();
      audio.addEventListener('ended', this.#endedHandler);
    }
    this.#timeupdateHandler = () => this.#detectTrackEnd(loop);
    audio.addEventListener('timeupdate', this.#timeupdateHandler);

    audio.play().catch((err: unknown) => {
      audioLog.warn('Web BGM play() rejected (autoplay policy?)', err);
      this.#isPlaying = false;
      this.#releaseTrack();
    });
    audioLog.debug('BGM track started', { index: this.#currentIndex });
  }

  /** WeChat ArkWeb fallback: may not fire `ended` and may ignore `audio.loop`. */
  #detectTrackEnd(loop: boolean): void {
    if (this.#trackEndFired) return;
    const element = this.#element;
    if (!element || !Number.isFinite(element.duration) || element.duration === 0) return;
    if (element.currentTime < element.duration - 0.5) return;

    if (!loop) {
      this.#handleTrackEnd();
      return;
    }
    this.#trackEndFired = true;
    audioLog.debug('timeupdate loop fallback triggered');
    element.currentTime = 0;
    element.play().catch((error: unknown) => {
      audioLog.warn('BGM loop fallback playback failed', error);
    });
    // Re-arm shortly after so the next cycle can fire again.
    setTimeout(() => {
      this.#trackEndFired = false;
    }, 1000);
  }

  #handleTrackEnd(): void {
    if (this.#trackEndFired) return;
    this.#trackEndFired = true;
    if (!this.#isPlaying) return;

    this.#element?.pause();
    this.#currentIndex++;
    if (this.#currentIndex >= this.#playlist.length) {
      this.#playlist = shuffleArray(this.#playlist);
      this.#currentIndex = 0;
      audioLog.debug('BGM playlist cycle complete, re-shuffled');
    }

    this.#gapTimer = setTimeout(() => {
      this.#gapTimer = null;
      this.#playCurrentTrack();
    }, PLAYLIST_GAP_MS);
  }

  #removeTrackListeners(audio: HTMLAudioElement): void {
    if (this.#endedHandler) {
      audio.removeEventListener('ended', this.#endedHandler);
      this.#endedHandler = null;
    }
    if (this.#timeupdateHandler) {
      audio.removeEventListener('timeupdate', this.#timeupdateHandler);
      this.#timeupdateHandler = null;
    }
  }

  /**
   * Pause, clear src and remove listeners. The element, its source node, the GainNode and
   * the shared AudioContext stay alive: the context is owned by AudioContextOwner, and the
   * element↔source binding is permanent (re-binding throws InvalidStateError).
   */
  #releaseTrack(): void {
    const audio = this.#element;
    if (!audio) return;
    this.#removeTrackListeners(audio);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

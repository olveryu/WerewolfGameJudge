/**
 * BgmPlayer — background music lifecycle manager.
 *
 * Responsibilities:
 * - Single-track loop mode (user-selected BGM)
 * - Playlist mode (shuffle all tracks, sequential playback, re-shuffle on cycle)
 * - Cross-platform backend: Web uses AudioContext + GainNode, Native uses expo-audio
 * - pause/resume on page visibility change
 *
 * Not responsible for:
 * - TTS voice playback (handled by AudioPlaybackStrategy)
 * - Deciding when to play (orchestrated by AudioOrchestrator)
 *
 * Boundary constraints:
 * - Web uses GainNode for volume control (iOS Safari ignores HTMLAudioElement.volume)
 * - AudioContext / GainNode / MediaElementAudioSourceNode / HTMLAudioElement
 *   are all reused across tracks — in WeChat web-view, creating `new Audio()` or
 *   AudioContext outside a user gesture is silently blocked
 * - WeChat web-view (HarmonyOS ArkWeb) may swallow the `ended` event and native `loop`;
 *   use `timeupdate` polling as a fallback to detect track end
 *
 * @remarks GainNode reuse: stop() does not release AudioContext/GainNode/element
 *   (WeChat ArkWeb limits AudioContext creation count). `timeupdate` fallback: when
 *   the `ended` event does not fire, detect `currentTime >= duration - 0.3s` in
 *   timeupdate to manually fire track end. #trackEndFired prevents
 *   double-fire from ended + timeupdate.
 */

import { shuffleArray } from '@werewolf/game-engine/utils/shuffle';
import type { AudioPlayer } from 'expo-audio';
import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { audioLog } from '@/utils/logger';

import { ensureAudioContextRunning, getAudioContext } from './AudioContextOwner';
import { BGM_VOLUME } from './audioRegistry';
import type { AudioAsset } from './types';
import { audioAssetToUrl } from './types';
import { getUnlockedBgmElement } from './webAudioUnlock';

const isWeb = Platform.OS === 'web';

/**
 * BgmPlayer — BGM player (single-track / playlist / shuffle).
 *
 * Web uses HTMLAudioElement, Native uses expo-audio.
 */
export class BgmPlayer {
  // ── Shared state ──
  #isPlaying = false;
  #playlist: AudioAsset[] = [];
  #currentIndex = 0;
  #isPlaylist = false;
  #volume = BGM_VOLUME;
  /** Timer for inter-track gap in playlist mode. */
  #gapTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Web backend ──
  // AudioContext + GainNode are reused across tracks to avoid autoplay policy
  // issues in WeChat web-view (new AudioContext() outside user gesture is blocked).
  #webElement: HTMLAudioElement | null = null;
  #webAudioCtx: AudioContext | null = null;
  #webGainNode: GainNode | null = null;
  // Prevents GC of the source node — the element↔source binding is permanent.
  // eslint-disable-next-line no-unused-private-class-members
  #webSourceNode: MediaElementAudioSourceNode | null = null;
  #webEndedHandler: (() => void) | null = null;
  #webTimeupdateHandler: (() => void) | null = null;
  /** Prevents double-fire when both `ended` and `timeupdate` detect track end. */
  #trackEndFired = false;

  // ── Native backend ──
  #nativePlayer: AudioPlayer | null = null;
  #nativeSubscription: { remove(): void } | null = null;

  getIsBgmPlaying(): boolean {
    return this.#isPlaying;
  }

  /**
   * Update BGM volume (0.0–1.0). Applies immediately to current playback.
   */
  setVolume(volume: number): void {
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#webGainNode) {
      this.#webGainNode.gain.value = this.#volume;
    }
    if (this.#nativePlayer) {
      this.#nativePlayer.volume = this.#volume;
    }
  }

  /**
   * Start BGM playback.
   * @param assets - Single asset = loop mode; multiple assets = playlist (shuffle + sequential).
   */
  async start(assets: AudioAsset[]): Promise<void> {
    if (this.#isPlaying) {
      audioLog.debug('BGM already playing, skipping');
      return;
    }
    if (assets.length === 0) {
      audioLog.warn('BGM start called with empty assets');
      return;
    }

    this.#isPlaylist = assets.length > 1;
    this.#playlist = this.#isPlaylist ? shuffleArray(assets) : assets;
    this.#currentIndex = 0;
    this.#isPlaying = true;

    audioLog.debug('Starting BGM', {
      mode: this.#isPlaylist ? 'playlist' : 'loop',
      count: assets.length,
    });
    this.#playCurrentTrack();
  }

  stop(): void {
    this.#isPlaying = false;
    if (this.#gapTimer) {
      clearTimeout(this.#gapTimer);
      this.#gapTimer = null;
    }
    this.#destroyWebPlayer();
    this.#cleanupNativePlayer();
    // Keep #webAudioCtx, #webGainNode, #webElement, and #webSourceNode alive.
    // AudioContext is a shared singleton owned by AudioContextOwner — closing or
    // nulling it poisons the singleton.  The element↔source binding is
    // permanent per spec (createMediaElementSource can only be called once
    // per element); nulling them causes an InvalidStateError on next start().
    audioLog.debug('BGM stopped');
  }

  pause(): void {
    if (this.#webElement) {
      try {
        this.#webElement.pause();
      } catch (e) {
        audioLog.warn('error pausing web bgm', e);
      }
    } else if (this.#nativePlayer) {
      try {
        this.#nativePlayer.pause();
      } catch (e) {
        audioLog.warn('error pausing bgm', e);
      }
    }
  }

  resume(): void {
    if (!this.#isPlaying) return;
    if (this.#webElement) {
      // Ensure shared context is running (covers WebKit suspended + interrupted).
      void ensureAudioContextRunning();
      this.#webElement.play().catch((e) => {
        audioLog.warn('error resuming web bgm', e);
      });
      audioLog.debug('resumed web BGM');
    } else if (this.#nativePlayer) {
      try {
        this.#nativePlayer.play();
        audioLog.debug('resumed BGM');
      } catch (e) {
        audioLog.warn('error resuming bgm', e);
      }
    }
  }

  // ─── Internal: play current track ──────────────────────────────────────

  #playCurrentTrack(): void {
    if (!this.#isPlaying) return;

    const asset = this.#playlist[this.#currentIndex]!;
    const loop = !this.#isPlaylist; // single-track = loop; playlist = no loop

    try {
      if (isWeb && typeof document !== 'undefined') {
        this.#playWeb(asset, loop);
      } else {
        this.#playNative(asset, loop);
      }
    } catch (error) {
      audioLog.warn('Failed to start BGM track', error);
      this.#isPlaying = false;
      this.#destroyWebPlayer();
      this.#cleanupNativePlayer();
    }
  }

  #playWeb(asset: AudioAsset, loop: boolean): void {
    const audioUrl = audioAssetToUrl(asset);

    // Reuse AudioContext + GainNode + HTMLAudioElement across tracks.
    // The shared AudioContext from AudioContextOwner MUST be available by the time
    // BGM plays (user already clicked "start game" / play button). Fail fast instead
    // of creating an unauthorized AudioContext that Chrome will suspend (causing
    // silent playback failure).
    if (!this.#webAudioCtx || this.#webAudioCtx.state === 'closed') {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'closed') {
        audioLog.error(
          'BgmPlayer: no shared AudioContext available — webAudioUnlock may not have fired',
        );
        return;
      }
      this.#webAudioCtx = ctx;
      this.#webGainNode = this.#webAudioCtx.createGain();
      this.#webGainNode.connect(this.#webAudioCtx.destination);
    }

    // Ensure the shared context is running before play so audio routes through the
    // GainNode → destination. Owner handles resume + iOS-interruption rejection;
    // fire-and-forget is safe because ensureAudioContextRunning never rejects.
    void ensureAudioContextRunning();
    const gain = this.#webGainNode!;
    gain.gain.value = this.#volume;

    let audio = this.#webElement;
    if (!audio) {
      // First track: prefer gesture-authorized element from webAudioUnlock pool.
      // Android WebView rejects play() on Audio elements created outside user gesture.
      audio = getUnlockedBgmElement() ?? new Audio(audioUrl);
      if (!audio.src || audio.src !== audioUrl) {
        audio.src = audioUrl;
      }
      const source = this.#webAudioCtx.createMediaElementSource(audio);
      source.connect(gain);
      this.#webElement = audio;
      this.#webSourceNode = source;
    } else {
      // Subsequent tracks: reuse element, just swap src
      audio.src = audioUrl;
    }
    audio.loop = loop;
    this.#trackEndFired = false;

    // Remove stale listeners before adding fresh ones
    if (this.#webEndedHandler) {
      audio.removeEventListener('ended', this.#webEndedHandler);
      this.#webEndedHandler = null;
    }
    if (this.#webTimeupdateHandler) {
      audio.removeEventListener('timeupdate', this.#webTimeupdateHandler);
      this.#webTimeupdateHandler = null;
    }

    if (!loop) {
      this.#webEndedHandler = () => this.#handleWebTrackEnd();
      audio.addEventListener('ended', this.#webEndedHandler);
    }

    // Fallback: WeChat web-view (HarmonyOS ArkWeb) may not fire `ended` and may
    // ignore `audio.loop`. Poll via `timeupdate` to detect track end.
    this.#webTimeupdateHandler = () => {
      if (this.#trackEndFired) return;
      const el = this.#webElement;
      if (!el || !Number.isFinite(el.duration) || el.duration === 0) return;
      if (el.currentTime < el.duration - 0.5) return;

      if (loop) {
        // Single-track loop fallback: seek back to start
        this.#trackEndFired = true;
        audioLog.debug('timeupdate loop fallback triggered');
        el.currentTime = 0;
        el.play().catch(() => {
          /* ignore */
        });
        // Reset flag shortly after so the next cycle can fire again
        setTimeout(() => {
          this.#trackEndFired = false;
        }, 1000);
      } else {
        // Playlist fallback: advance to next track
        this.#handleWebTrackEnd();
      }
    };
    audio.addEventListener('timeupdate', this.#webTimeupdateHandler);

    audio.play().catch((err) => {
      audioLog.warn('Web BGM play() rejected (autoplay policy?)', err);
      this.#isPlaying = false;
      this.#destroyWebPlayer();
    });
    audioLog.debug('BGM track started (Web)', { index: this.#currentIndex });
  }

  /** Deduplicated handler for web track end (called by `ended` or `timeupdate`). */
  #handleWebTrackEnd(): void {
    if (this.#trackEndFired) return;
    this.#trackEndFired = true;
    this.#onTrackEnded();
  }

  #playNative(asset: AudioAsset, loop: boolean): void {
    const player = createAudioPlayer(asset);
    this.#nativePlayer = player;
    player.volume = this.#volume;
    player.loop = loop;

    if (!loop) {
      this.#nativeSubscription = player.addListener('playbackStatusUpdate', (status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          this.#onTrackEnded();
        }
      });
    }

    player.play();
    audioLog.debug('BGM track started (Native)', { index: this.#currentIndex });
  }

  #onTrackEnded(): void {
    if (!this.#isPlaying) return;

    // Native: full cleanup between tracks (no autoplay policy issue)
    if (this.#nativePlayer) {
      this.#cleanupNativePlayer();
    }
    // Web: just pause — keep element + AudioContext alive for next track
    if (this.#webElement) {
      try {
        this.#webElement.pause();
      } catch {
        /* ignore */
      }
    }

    this.#currentIndex++;

    if (this.#currentIndex >= this.#playlist.length) {
      // Re-shuffle and restart from beginning
      this.#playlist = shuffleArray(this.#playlist);
      this.#currentIndex = 0;
      audioLog.debug('BGM playlist cycle complete, re-shuffled');
    }

    // Brief silence between tracks so the listener notices the transition
    this.#gapTimer = setTimeout(() => {
      this.#gapTimer = null;
      this.#playCurrentTrack();
    }, 2000);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────

  /**
   * Stop web playback — pause + clear src + remove listeners.
   *
   * The HTMLAudioElement, MediaElementAudioSourceNode, AudioContext, and
   * GainNode are intentionally kept alive:
   * - AudioContext is a shared singleton owned by AudioContextOwner.
   * - createMediaElementSource() permanently binds an element to a source
   *   node (spec §1.22); calling it again on the same element throws
   *   InvalidStateError.  Reuse the binding and swap src instead.
   */
  #destroyWebPlayer(): void {
    if (this.#webElement) {
      if (this.#webEndedHandler) {
        this.#webElement.removeEventListener('ended', this.#webEndedHandler);
        this.#webEndedHandler = null;
      }
      if (this.#webTimeupdateHandler) {
        this.#webElement.removeEventListener('timeupdate', this.#webTimeupdateHandler);
        this.#webTimeupdateHandler = null;
      }
      try {
        this.#webElement.pause();
        this.#webElement.removeAttribute('src');
        this.#webElement.load();
      } catch {
        /* ignore */
      }
    }
  }

  #cleanupNativePlayer(): void {
    if (this.#nativeSubscription) {
      this.#nativeSubscription.remove();
      this.#nativeSubscription = null;
    }
    if (this.#nativePlayer) {
      try {
        this.#nativePlayer.pause();
        this.#nativePlayer.remove();
      } catch {
        /* ignore */
      }
      this.#nativePlayer = null;
    }
  }
}

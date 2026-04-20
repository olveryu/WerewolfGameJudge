/**
 * webAudioUnlock — unlock Web Audio API + HTMLAudioElement on first user gesture.
 *
 * Android WebView (Chromium / WeChat X5) requires `AudioContext.resume()` and
 * `HTMLAudioElement.play()` to execute within a user-gesture call stack.
 * Game audio starts after an async chain (button → network → state → play),
 * so the gesture context is lost by the time `play()` runs.
 *
 * This module registers capture-phase listeners on the first user interaction
 * (touch / click / keydown). On trigger it:
 *   1. Creates an AudioContext, plays a 1-sample silent buffer, calls resume().
 *   2. Creates an HTMLAudioElement and plays a silent WAV data URI.
 * Both objects are then "gesture-authorized" — subsequent `src` swaps + `play()`
 * calls no longer require a user gesture.
 *
 * Consumers (`WebAudioStrategy`, `BgmPlayer`) call `getUnlockedAudioElement()`
 * / `getUnlockedAudioContext()` to reuse these pre-authorized instances instead
 * of creating new ones.
 *
 * Pattern adopted from howler.js `_unlockAudio()` (24k+ stars, 10 years maintained)
 * and recommended by Chrome (developer.chrome.com/blog/autoplay) + MDN.
 *
 * Web-only module. No-op on native platforms.
 */

import { audioLog } from '@/utils/logger';

// Minimal valid WAV: 1 sample, 22050 Hz, mono, 16-bit
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let unlocked = false;
let unlockedAudioCtx: AudioContext | null = null;
let unlockedAudioElement: HTMLAudioElement | null = null;

/**
 * Get the gesture-authorized AudioContext (for BgmPlayer's GainNode routing).
 * Returns null if unlock hasn't fired yet; callers fall back to creating their own.
 */
export function getUnlockedAudioContext(): AudioContext | null {
  return unlockedAudioCtx;
}

/**
 * Get the gesture-authorized HTMLAudioElement (for WebAudioStrategy TTS playback).
 * Returns null if unlock hasn't fired yet; callers fall back to creating their own.
 */
export function getUnlockedAudioElement(): HTMLAudioElement | null {
  return unlockedAudioElement;
}

function unlock(): void {
  if (unlocked) return;

  audioLog.debug('webAudioUnlock: user gesture detected, unlocking audio');

  // ── 1. Unlock AudioContext (Web Audio API) ──
  try {
    const ctx = new AudioContext();
    // Play a 1-sample silent buffer to transition state to "running"
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    // Explicitly resume (required on Android Chrome 55+)
    if (typeof ctx.resume === 'function') {
      void ctx.resume();
    }

    source.onended = () => {
      source.disconnect(0);
      audioLog.debug('webAudioUnlock: AudioContext unlocked');
    };

    unlockedAudioCtx = ctx;
  } catch (e) {
    audioLog.warn('webAudioUnlock: AudioContext unlock failed', e);
  }

  // ── 2. Unlock HTMLAudioElement (HTML5 Audio) ──
  try {
    const audio = new Audio();
    audio.src = SILENT_WAV;
    // play() must be called synchronously within the gesture handler
    audio.play().then(
      () => {
        audioLog.debug('webAudioUnlock: HTMLAudioElement unlocked');
      },
      () => {
        audioLog.warn('webAudioUnlock: HTMLAudioElement unlock play() rejected');
      },
    );
    unlockedAudioElement = audio;
  } catch (e) {
    audioLog.warn('webAudioUnlock: HTMLAudioElement unlock failed', e);
  }

  unlocked = true;
  teardownListeners();
}

// ── Listener management ──

const events = ['touchstart', 'touchend', 'click', 'keydown'] as const;

function teardownListeners(): void {
  for (const evt of events) {
    document.removeEventListener(evt, unlock, true);
  }
}

/**
 * Register user-gesture listeners to unlock audio.
 * Call once from AudioService.#initAudio() on web platform.
 * Safe to call multiple times (idempotent).
 */
export function setupWebAudioUnlock(): void {
  if (typeof document === 'undefined') return;
  if (unlocked) return;

  for (const evt of events) {
    document.addEventListener(evt, unlock, true);
  }
  audioLog.debug('webAudioUnlock: listeners registered');
}

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
 *   1. Creates an HTMLAudioElement pool (gesture-authorized by creation context).
 *   2. Creates an AudioContext, plays a 1-sample silent buffer, calls resume().
 *
 * HTMLAudioElement is created **before** AudioContext because Safari/WKWebView's
 * user-activation token is consumed by `AudioContext.resume()` / `source.start()`,
 * causing a subsequent `audio.play()` to be rejected. By creating the Audio
 * element first (matching howler.js `_unlockAudio()` order), both paths succeed.
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

  // ── 1. Create HTMLAudioElement (HTML5 Audio) ──
  // MUST come before AudioContext: Safari/WKWebView's user-activation token
  // is consumed by AudioContext operations, so a later audio.play() would
  // be rejected.  Following howler.js, we only need to new Audio() inside
  // the gesture handler — the element is then "gesture-authorized" for
  // subsequent src swaps + play() calls.
  try {
    const audio = new Audio();
    audio.src = SILENT_WAV;
    audio.load();
    unlockedAudioElement = audio;
    audioLog.debug('webAudioUnlock: HTMLAudioElement created');
  } catch (e) {
    audioLog.warn('webAudioUnlock: HTMLAudioElement creation failed', e);
  }

  // ── 2. Unlock AudioContext (Web Audio API) ──
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

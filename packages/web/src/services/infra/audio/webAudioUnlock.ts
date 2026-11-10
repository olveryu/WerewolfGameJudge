/**
 * webAudioUnlock — gesture listener + gesture-authorized HTMLAudioElement pool.
 *
 * Android WebView (Chromium / WeChat X5) and iOS WebKit require
 * `HTMLAudioElement.play()` to originate from a user-gesture call stack. Game
 * audio starts after an async chain (button → network → state → play), so the
 * gesture context is lost by the time `play()` runs.
 *
 * This module registers capture-phase listeners for the first user interaction
 * (touch / click / keydown). On trigger it:
 *   1. Creates the foreground and BGM HTMLAudioElements, which stay gesture-authorized
 *      (by their creation context) for later src swaps and `play()` calls.
 *   2. Asks {@link createAudioContext} to create the shared AudioContext.
 *
 * The elements are created **before** the AudioContext because Safari/WKWebView's
 * user-activation token is consumed by `AudioContext.resume()` / `source.start()`,
 * causing a subsequent `audio.play()` to be rejected (howler.js `_unlockAudio()` order).
 *
 * Scope split: the element pool IS a one-shot unlock, so it lives here. The AudioContext
 * *running state* is NOT one-shot on iOS (it can drop to `interrupted`), so its lifecycle
 * and state authority live in {@link ./AudioContextOwner}.
 *
 * Consumers (`WebAudioStrategy`, `BgmPlayer`) reuse the elements through
 * `getUnlockedAudioElement()` / `getUnlockedBgmElement()`.
 *
 * Pattern adopted from howler.js `_unlockAudio()` and recommended by Chrome
 * (developer.chrome.com/blog/autoplay) + MDN.
 */

import { audioLog } from '@/utils/logger';

import { createAudioContext } from './AudioContextOwner';

// Minimal valid WAV: 1 sample, 22050 Hz, mono, 16-bit
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let unlocked = false;
let unlockedAudioElement: HTMLAudioElement | null = null;
let unlockedBgmElement: HTMLAudioElement | null = null;

/**
 * Get the gesture-authorized HTMLAudioElement for foreground game audio.
 * Returns null if unlock hasn't fired yet; callers fall back to creating their own.
 */
export function getUnlockedAudioElement(): HTMLAudioElement | null {
  return unlockedAudioElement;
}

/**
 * Get the gesture-authorized HTMLAudioElement for BGM playback. Separate from the
 * foreground element because both play simultaneously and each binds its own
 * MediaElementAudioSourceNode. Returns null if unlock hasn't fired yet.
 */
export function getUnlockedBgmElement(): HTMLAudioElement | null {
  return unlockedBgmElement;
}

function unlock(): void {
  if (unlocked) return;

  audioLog.debug('webAudioUnlock: user gesture detected, unlocking audio');

  // Creating the elements inside the gesture handler is what authorizes them; this MUST
  // precede the AudioContext (Safari consumes the activation token on context ops).
  try {
    const audio = new Audio();
    audio.src = SILENT_WAV;
    audio.load();
    unlockedAudioElement = audio;

    const bgmAudio = new Audio();
    bgmAudio.crossOrigin = 'anonymous';
    bgmAudio.src = SILENT_WAV;
    bgmAudio.load();
    unlockedBgmElement = bgmAudio;

    audioLog.debug('webAudioUnlock: HTMLAudioElements created (foreground + BGM)');
  } catch (e) {
    audioLog.warn('webAudioUnlock: HTMLAudioElement creation failed', e);
  }

  createAudioContext();

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
 * Register user-gesture listeners to unlock audio. Called synchronously from the
 * `AudioService` constructor. Safe to call multiple times (idempotent).
 */
export function setupWebAudioUnlock(): void {
  if (unlocked) return;

  for (const evt of events) {
    document.addEventListener(evt, unlock, true);
  }
  audioLog.debug('webAudioUnlock: listeners registered');
}

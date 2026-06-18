/**
 * webAudioUnlock — gesture listener + gesture-authorized HTMLAudioElement pool.
 *
 * Android WebView (Chromium / WeChat X5) and iOS WebKit require
 * `HTMLAudioElement.play()` to originate from a user-gesture call stack. Game
 * audio starts after an async chain (button → network → state → play), so the
 * gesture context is lost by the time `play()` runs.
 *
 * This module registers capture-phase listeners on the first user interaction
 * (touch / click / keydown). On trigger it:
 *   1. Creates an HTMLAudioElement pool (gesture-authorized by creation context).
 *   2. Asks {@link createAudioContext} to create the shared AudioContext.
 *
 * HTMLAudioElement is created **before** the AudioContext because Safari/WKWebView's
 * user-activation token is consumed by `AudioContext.resume()` / `source.start()`,
 * causing a subsequent `audio.play()` to be rejected. By creating the Audio
 * element first (matching howler.js `_unlockAudio()` order), both paths succeed.
 *
 * Scope split: the HTMLAudioElement pool IS a one-shot unlock (a created element
 * stays authorized), so it lives here. The AudioContext *running state* is NOT
 * one-shot on iOS (it can drop to `interrupted`), so its lifecycle + state authority
 * live in {@link ./AudioContextOwner}.
 *
 * Consumers (`WebAudioStrategy`, `BgmPlayer`) call `getUnlockedAudioElement()`
 * / `getUnlockedBgmElement()` to reuse these pre-authorized elements.
 *
 * Pattern adopted from howler.js `_unlockAudio()` (24k+ stars, 10 years maintained)
 * and recommended by Chrome (developer.chrome.com/blog/autoplay) + MDN.
 *
 * Web-only module. No-op on native platforms.
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
 * Get the gesture-authorized HTMLAudioElement (for WebAudioStrategy TTS playback).
 * Returns null if unlock hasn't fired yet; callers fall back to creating their own.
 */
export function getUnlockedAudioElement(): HTMLAudioElement | null {
  return unlockedAudioElement;
}

/**
 * Get the gesture-authorized HTMLAudioElement for BGM playback.
 * Separate from the TTS element because both may play simultaneously
 * (BGM loops while TTS plays role audio). Each element needs its own
 * MediaElementAudioSourceNode binding.
 * Returns null if unlock hasn't fired yet; callers fall back to creating their own.
 */
export function getUnlockedBgmElement(): HTMLAudioElement | null {
  return unlockedBgmElement;
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
  // Create two separate Audio elements (howler.js creates a pool of 10).
  // We need exactly two: one for TTS (WebAudioStrategy) and one for BGM
  // (BgmPlayer), since both play simultaneously and each binds to its own
  // MediaElementAudioSourceNode.
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

    audioLog.debug('webAudioUnlock: HTMLAudioElements created (TTS + BGM)');
  } catch (e) {
    audioLog.warn('webAudioUnlock: HTMLAudioElement creation failed', e);
  }

  // ── 2. Create the shared AudioContext ──
  // Must run AFTER element creation (Safari consumes the activation token on
  // AudioContext ops). Lifecycle + state authority live in AudioContextOwner.
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

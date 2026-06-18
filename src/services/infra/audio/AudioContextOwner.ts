/**
 * AudioContextOwner — single authority for the shared Web AudioContext lifecycle + state.
 *
 * Why this exists: iOS WebKit's AudioContext is NOT a one-shot unlock. It has an
 * `interrupted` state (phone call, audio-hardware preemption, backgrounding) that can
 * drop the context out of `running` at any time, and the browser decides when it may
 * resume (MDN: BaseAudioContext.state). The previous "unlock once, then assume forever
 * available" model could not express this, so consumers each guessed at
 * `state === 'suspended'` (missing `interrupted`) and dropped the resume() promise.
 *
 * This owner holds the AudioContext singleton and exposes a declarative
 * `ensureAudioContextRunning()` that consumers call before every playback, instead of
 * inspecting context state themselves. State management lives here and only here.
 *
 * Boundary constraints:
 * - `createAudioContext()` MUST be called inside a user-gesture call stack, and AFTER
 *   any HTMLAudioElement creation (Safari/WKWebView consumes the user-activation token
 *   on AudioContext ops). webAudioUnlock enforces this ordering.
 * - Web-only. Consumers are gated behind `Platform.OS === 'web'`.
 */

import { audioLog } from '@/utils/logger';

let ctx: AudioContext | null = null;

/**
 * Create the shared AudioContext. MUST run within a user gesture and after the
 * HTMLAudioElement pool is created (see webAudioUnlock). Idempotent: returns the
 * existing context if one is already live.
 *
 * Plays a 1-sample silent buffer to transition the context to `running` and calls
 * resume() (required on Android Chrome 55+). A rejected resume() is an expected iOS
 * audio-session interruption — logged at warn, not reported.
 */
export function createAudioContext(): AudioContext | null {
  if (ctx && ctx.state !== 'closed') return ctx;

  try {
    const created = new AudioContext();

    // Silent 1-sample buffer transitions state toward "running".
    const buffer = created.createBuffer(1, 1, 22050);
    const source = created.createBufferSource();
    source.buffer = buffer;
    source.connect(created.destination);
    source.start(0);
    source.onended = () => {
      source.disconnect(0);
      audioLog.debug('AudioContextOwner: context unlocked');
    };

    // Explicit resume (Android Chrome 55+). Reject = active iOS interruption; expected.
    created.resume().catch((e) => {
      audioLog.warn('AudioContextOwner: initial resume rejected (iOS interruption?)', e);
    });

    ctx = created;
    return ctx;
  } catch (e) {
    audioLog.warn('AudioContextOwner: context creation failed', e);
    return null;
  }
}

/**
 * The shared AudioContext, or null if the unlock gesture hasn't fired yet.
 * Consumers use this to create their own GainNode / MediaElementAudioSourceNode
 * routing on top of the shared context.
 */
export function getAudioContext(): AudioContext | null {
  return ctx;
}

/**
 * Ensure the shared context is `running`. Comparing only against `running` covers
 * BOTH WebKit `suspended` and `interrupted` without naming the (non-standard,
 * not-in-lib.dom) `interrupted` literal.
 *
 * Returns false (never throws) when no context exists yet or resume() is rejected by
 * an active iOS audio-session interruption — an expected, recoverable environment
 * condition (warn, no Sentry). Callers fire-and-forget safely.
 */
export async function ensureAudioContextRunning(): Promise<boolean> {
  const c = ctx;
  if (!c) return false;

  // `state` is read as a string: lib.dom's AudioContextState union omits WebKit's
  // `interrupted` value and treats state as constant across the await, so comparing
  // the typed union would mis-narrow. Reading as string reflects runtime reality.
  const before: string = c.state;
  if (before === 'closed') return false;
  if (before === 'running') return true;

  try {
    await c.resume();
    const after: string = c.state;
    return after === 'running';
  } catch (e) {
    audioLog.warn('AudioContextOwner: resume rejected (iOS interruption?)', e);
    return false;
  }
}

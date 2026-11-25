/**
 * Avalon night progression: the shared step mechanism decides whether
 * the current reveal advances (every actor viewed AND the narration
 * gate is open); this module only wraps its events for the Avalon
 * event stream and queues the transition narration in the same
 * decision. Viewing and the audio ack are independent inputs, so their
 * arrival order does not matter — the decide exit re-evaluates after
 * either one. A single pass suffices: every advance queues a fresh
 * narration batch, which closes the audio gate again. No IO.
 */

import type { AudioEffect } from '../../../platform/audio';
import { evaluateStepProgress } from '../../../platform/steps';
import type { AvalonState } from '../state/types';
import type { AvalonEvent } from './decision';
import { createAvalonNightRuntime } from './nightSteps';

/** 夜晚播报队列事件；入队纪律（空批 fail-fast＋整批拷贝＋批次 id）由 evolve 里的共享音频机器负责。 */
export function queueAudio(effects: readonly AudioEffect[]): AvalonEvent {
  if (effects.length === 0) {
    throw new Error('[FAIL-FAST] Audio queue requires at least one effect');
  }
  return { type: 'avalon.audio.queued', effects: [...effects] };
}

/**
 * Returns the current step's progression events plus the transition
 * narration batch when the step advances, or [] when it does not —
 * including the legal intermediate state where every actor has viewed
 * but the narration is still playing.
 *
 * @pre Pure read of state; callers pass the post-command intermediate
 * state (the command's own events already evolved).
 */
export function evaluateAvalonNightProgress(
  state: AvalonState,
  nowMs: number,
): readonly AvalonEvent[] {
  if (state.phase.kind !== 'night') return [];
  return evaluateStepProgress(createAvalonNightRuntime(), state, nowMs).flatMap(
    (event): AvalonEvent[] =>
      event.type === 'advanced'
        ? [{ type: 'avalon.night.step', event }, queueAudio(event.audio)]
        : [{ type: 'avalon.night.step', event }],
  );
}

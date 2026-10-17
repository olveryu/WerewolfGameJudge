/**
 * Avalon night completion evaluation: the one place that decides
 * whether the current night step advances. A step completes when its
 * whole participant set has confirmed AND the narration gate is open
 * (the host has acked the current audio batch); confirmation recording
 * and the audio ack are independent inputs, so their arrival order
 * does not matter — the decide exit re-evaluates after either one.
 *
 * A single evaluation pass always suffices (no werewolf-style loop):
 * every advance enqueues a fresh narration batch in the same decision,
 * which closes the audio gate again, and the stepped evolve clears the
 * confirmation set — a second pass over the advanced state provably
 * returns []. The final step lands in the nominate phase, which the
 * first check below rejects outright.
 *
 * No IO.
 */

import { type AudioEffect, isAudioGateOpen, queueAudioBatch } from '../../../platform/audio';
import { AVALON_NIGHT_STEPS, type AvalonState } from '../state/types';
import type { AvalonEvent } from './decision';
import { getAvalonNightStepDef, getAvalonNightStepEndKey } from './nightSteps';
import { getAvalonNightParticipants } from './rules';

/** 夜晚播报队列事件；入队纪律（空批 fail-fast＋整批拷贝）由共享音频机器负责。 */
export function queueAudio(effects: readonly AudioEffect[]): AvalonEvent {
  return { type: 'avalon.audio.queued', effects: queueAudioBatch(effects).pendingAudioEffects };
}

/**
 * Returns the current step's progression events (stepped/completed
 * plus the transition narration batch) when the step is complete, or
 * [] when it is not — including the legal intermediate state where
 * every participant has confirmed but the narration is still playing.
 *
 * @pre Pure read of state; callers pass the post-command intermediate
 * state (the command's own events already evolved).
 */
export function evaluateAvalonNightCompletion(state: AvalonState): readonly AvalonEvent[] {
  const phase = state.phase;
  if (phase.kind !== 'night') return [];
  if (!isAudioGateOpen(state)) return [];
  const participants = getAvalonNightParticipants(state.roles, phase.step);
  if (!participants.every((seat) => phase.confirmedSeats.includes(seat))) return [];
  const def = getAvalonNightStepDef(phase.step);
  const nextStep = AVALON_NIGHT_STEPS[AVALON_NIGHT_STEPS.indexOf(phase.step) + 1];
  if (nextStep === undefined) {
    return [
      { type: 'avalon.night.completed' },
      queueAudio([
        { audioKey: getAvalonNightStepEndKey(def), isEndAudio: true },
        { audioKey: 'night_end' },
      ]),
    ];
  }
  return [
    { type: 'avalon.night.stepped', step: nextStep },
    queueAudio([
      { audioKey: getAvalonNightStepEndKey(def), isEndAudio: true },
      { audioKey: getAvalonNightStepDef(nextStep).audioKey },
    ]),
  ];
}

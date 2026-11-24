/** Test helpers that drive the Avalon night through the shared step mechanism. */

import type { AvalonCommand } from '../commands/types';
import { AVALON_NIGHT_VIEW_ACTION_KEY, getAvalonNightParticipants } from '../domain/nightSteps';
import type { AvalonNightStep, AvalonPhase, AvalonState } from '../state/types';

/** The view submission for the current night step, as the client would send it. */
export function viewNight(state: AvalonState): AvalonCommand {
  const current = state.phase.kind === 'night' ? state.phase.steps.current : null;
  if (current === null) throw new Error('No active Avalon night step');
  return {
    type: 'avalon.step.submit',
    gameSequence: state.gameSequence,
    submission: {
      stepId: current.stepId,
      serial: current.serial,
      actionKey: AVALON_NIGHT_VIEW_ACTION_KEY,
    },
  };
}

/** The current night step of a night phase. */
export function currentNightStep(phase: AvalonPhase): AvalonNightStep | null {
  return phase.kind === 'night' ? (phase.steps.current?.stepId ?? null) : null;
}

/** Seats that viewed the current night step, ascending. */
export function viewedNightSeats(phase: AvalonPhase): readonly number[] {
  if (phase.kind !== 'night' || phase.steps.current === null) return [];
  const record = phase.steps.records[phase.steps.current.stepId];
  return Object.keys(record?.bySeat ?? {})
    .map(Number)
    .sort((left, right) => left - right);
}

/** Seats that must view the current night step. */
export function currentNightActors(state: AvalonState): readonly number[] {
  const step = currentNightStep(state.phase);
  return step === null ? [] : getAvalonNightParticipants(state.roles, step);
}

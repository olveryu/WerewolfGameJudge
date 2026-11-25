import { GameStatus } from '../domain/models';
import type { GameState } from '../domain/protocol/types';
import { createWerewolfNightState } from '../roles/nightEvolution';

/** Where a hand-built night stands; omitted means the night's first step. */
export interface TestNightPosition {
  readonly stepId: string;
  readonly deadlineMs?: number;
}

/**
 * Add the night to a fully dealt state used by boundary tests: parked on
 * `position` while the night runs, finished once the status has left it.
 */
export function withTestNightState(state: GameState, position?: TestNightPosition): GameState {
  const night = createWerewolfNightState(state);
  if (state.status !== GameStatus.Ongoing) {
    return {
      ...state,
      nightState: { ...night, slice: { ...night.slice, current: null, deadlineMs: null } },
    };
  }
  if (position === undefined) return { ...state, nightState: night };
  const serial = night.slice.order.indexOf(position.stepId) + 1;
  if (serial === 0) throw new Error(`[TEST] Step ${position.stepId} is not in this night`);
  return {
    ...state,
    nightState: {
      ...night,
      slice: {
        ...night.slice,
        current: { stepId: position.stepId, serial },
        deadlineMs: position.deadlineMs ?? null,
      },
    },
  };
}

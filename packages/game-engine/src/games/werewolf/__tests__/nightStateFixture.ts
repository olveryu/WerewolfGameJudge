import { GameStatus } from '../domain/models';
import type { GameState } from '../domain/protocol/types';
import { createWerewolfNightState } from '../roles/nightEvolution';

/** Add a spec-driven night to a fully dealt state used by boundary tests. */
export function withTestNightState(state: GameState): GameState {
  const night = createWerewolfNightState(state);
  const step = state.status === GameStatus.Ongoing ? state.nightStep : null;
  const current =
    step?.kind === 'inStep'
      ? { stepId: step.stepId, serial: night.slice.order.indexOf(step.stepId) + 1 }
      : null;
  return {
    ...state,
    nightState: {
      ...night,
      slice: {
        ...night.slice,
        current,
        deadlineMs: step?.kind === 'inStep' ? (step.stepDeadline ?? null) : null,
      },
    },
  };
}

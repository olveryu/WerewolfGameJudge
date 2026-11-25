/** Builds the night view submission a client sends for the current Avalon night step. */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { AVALON_NIGHT_VIEW_ACTION_KEY } from '@game-judge/game-engine/games/avalon/public';

/** The `avalon.step.submit` view command for the current night step. */
export function viewNightCommand(state: AvalonState): AvalonPublicCommand {
  if (state.phase.kind !== 'night' || state.phase.steps.current === null) {
    throw new Error('Expected an active Avalon night step');
  }
  const { stepId, serial } = state.phase.steps.current;
  return {
    type: 'avalon.step.submit',
    gameSequence: state.gameSequence,
    submission: { stepId, serial, actionKey: AVALON_NIGHT_VIEW_ACTION_KEY },
  };
}

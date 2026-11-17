/** Applies Spotmatch domain events; reset paths clear all game-owned state. */

import { applyRosterChanges } from '../../../platform/room/seating';
import type { SpotmatchState } from '../state/types';
import type { SpotmatchEvent } from './decision';

/** Resets mutable game data while preserving room configuration and seats. */
function resetSpotmatchGame(state: SpotmatchState): SpotmatchState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    xpSettled: false,
    round: null,
  };
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveSpotmatchState(state: SpotmatchState, event: SpotmatchEvent): SpotmatchState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'spotmatch.seats.changed':
      return { ...bumped, roster: applyRosterChanges(state.roster, event.changes) };
    case 'spotmatch.config.updated':
      return { ...bumped, config: event.config };
    case 'spotmatch.game.started':
      return {
        ...resetSpotmatchGame(state),
        phaseRevision: state.phaseRevision + 1,
        phase: { kind: 'playing' },
        gameSequence: event.gameSequence,
        round: event.round,
      };
    case 'spotmatch.round.updated':
      return { ...bumped, round: event.round };
    case 'spotmatch.game.ended': {
      if (state.phase.kind === 'ended') return state;
      return { ...bumped, phase: { kind: 'ended' }, xpSettled: true };
    }
    case 'spotmatch.game.returnedToLobby':
      return resetSpotmatchGame(state);
  }
}

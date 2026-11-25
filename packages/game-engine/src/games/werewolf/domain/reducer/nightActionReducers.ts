/**
 * Night boundary reducers — entering the night and writing its outcome.
 *
 * Pure functions: (state, action) => newState. Everything that happens
 * inside the night lives in `nightState` and evolves through night events.
 */

import { getHumanSeatMap } from '../../../../platform/room/seating';
import { GameStatus } from '../models';
import type { GameState } from '../protocol/types';
import type { EndNightAction, StartNightAction } from './types';

/** Start night (set the initial night step, clear actions/results). */
export function handleStartNight(state: GameState, _action: StartNightAction): GameState {
  return {
    ...state,
    status: GameStatus.Ongoing,
    startingParticipants: Object.values(
      getHumanSeatMap(state.roster, Object.keys(state.players).length),
    ).map((occupant) => ({ userId: occupant.userId, seat: occupant.seat })),
    // The night itself arrives with the following `initialized` night event.
    nightState: null,
  };
}

/** End night (write death results, transition status to Ended). */
export function handleEndNight(state: GameState, action: EndNightAction): GameState {
  const { deaths, deathReasons } = action.payload;
  const isSheriffElectionEnabled = state.rules?.isSheriffElectionEnabled === true;
  return {
    ...state,
    status: isSheriffElectionEnabled ? GameStatus.Day : GameStatus.Ended,
    lastNightDeaths: deaths,
    deathReasons,
    sheriffElection: isSheriffElectionEnabled
      ? {
          phase: 'registration',
          registeredSeats: [],
          withdrawnSeats: [],
          completedRounds: [],
        }
      : undefined,
    sheriffElectionResult: undefined,
    // Clear step state and audio state when night ends.
    isAudioPlaying: false,
  };
}

/**
 * Sheriff-election reducers apply validated election events.
 *
 * Pure functions only. Candidate and voter eligibility is decided by the handler layer.
 *
 * @pre All actions were produced by sheriffElectionHandler for a Day state.
 */

import { GameStatus } from '../models';
import type { GameState, SheriffElectionState } from '../protocol/types';
import type {
  AdvanceSheriffElectionAction,
  CancelSheriffRegistrationAction,
  CastSheriffVoteAction,
  CompleteSheriffElectionAction,
  RegisterSheriffCandidateAction,
  WithdrawSheriffCandidateAction,
} from './types';

function requireSheriffElection(state: GameState): SheriffElectionState {
  if (state.sheriffElection === undefined) {
    throw new Error('[FAIL-FAST] Sheriff election action requires election state');
  }
  return state.sheriffElection;
}

export function handleRegisterSheriffCandidate(
  state: GameState,
  action: RegisterSheriffCandidateAction,
): GameState {
  const election = requireSheriffElection(state);
  return {
    ...state,
    sheriffElection: {
      ...election,
      registeredSeats: [...election.registeredSeats, action.payload.seat],
    },
  };
}

export function handleCancelSheriffRegistration(
  state: GameState,
  action: CancelSheriffRegistrationAction,
): GameState {
  const election = requireSheriffElection(state);
  return {
    ...state,
    sheriffElection: {
      ...election,
      registeredSeats: election.registeredSeats.filter((seat) => seat !== action.payload.seat),
    },
  };
}

export function handleWithdrawSheriffCandidate(
  state: GameState,
  action: WithdrawSheriffCandidateAction,
): GameState {
  const election = requireSheriffElection(state);
  return {
    ...state,
    sheriffElection: {
      ...election,
      withdrawnSeats: [...election.withdrawnSeats, action.payload.seat],
    },
  };
}

export function handleCastSheriffVote(state: GameState, action: CastSheriffVoteAction): GameState {
  const election = requireSheriffElection(state);
  if (election.phase !== 'firstVote' && election.phase !== 'runoffVote') {
    throw new Error('[FAIL-FAST] Sheriff vote action requires a voting phase');
  }
  return {
    ...state,
    sheriffElection: {
      ...election,
      ballots: { ...election.ballots, [action.payload.voterSeat]: action.payload.targetSeat },
    },
  };
}

export function handleAdvanceSheriffElection(
  state: GameState,
  action: AdvanceSheriffElectionAction,
): GameState {
  requireSheriffElection(state);
  return { ...state, sheriffElection: action.payload.election };
}

export function handleCompleteSheriffElection(
  state: GameState,
  action: CompleteSheriffElectionAction,
): GameState {
  const election = requireSheriffElection(state);
  const completedRounds =
    action.payload.completedRound === undefined
      ? election.completedRounds
      : [...election.completedRounds, action.payload.completedRound];
  return {
    ...state,
    status: GameStatus.Ended,
    sheriffElection: {
      phase: 'completed',
      registeredSeats: election.registeredSeats,
      withdrawnSeats: election.withdrawnSeats,
      completedRounds,
    },
    sheriffElectionResult: action.payload.result,
  };
}

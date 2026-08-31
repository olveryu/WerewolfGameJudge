/**
 * Server-authoritative first-day sheriff-election rules.
 *
 * @remarks Gates are evaluated from status to phase to actor eligibility. A seeded random start
 * seat and direction define the physical table traversal for candidate speeches. Ballots remain
 * editable until the Host closes a round; closed rounds are appended to the public election record
 * before any winner or runoff transition is decided. Runoff speakers use the reverse of their
 * relative first-round speaking order, so the candidate who spoke later speaks first.
 */

import { createSeededRng, randomBool, randomIntInclusive } from '../../../../platform/random';
import type {
  AdvanceSheriffElectionIntent,
  CancelSheriffRegistrationIntent,
  CastSheriffVoteIntent,
  RegisterSheriffCandidateIntent,
  WithdrawSheriffCandidateIntent,
} from '../intents/types';
import { GameStatus } from '../models';
import type {
  GameState,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '../protocol/types';
import type {
  AdvanceSheriffElectionAction,
  CancelSheriffRegistrationAction,
  CastSheriffVoteAction,
  CompleteSheriffElectionAction,
  RegisterSheriffCandidateAction,
  StateAction,
  WithdrawSheriffCandidateAction,
} from '../reducer/types';
import {
  type HandlerContext,
  type HandlerError,
  handlerError,
  type HandlerResult,
  handlerSuccess,
} from './types';

type VotingElectionState = Extract<
  SheriffElectionState,
  { readonly phase: 'firstVote' | 'runoffVote' }
>;

type SheriffElectionGate =
  | { readonly kind: 'allowed'; readonly election: SheriffElectionState }
  | { readonly kind: 'rejected'; readonly error: HandlerError };

function resolveSheriffElectionGate(context: HandlerContext): SheriffElectionGate {
  if (context.state.status !== GameStatus.Day) {
    return { kind: 'rejected', error: handlerError('invalid_status') };
  }
  if (context.state.isAudioPlaying) {
    return { kind: 'rejected', error: handlerError('forbidden_while_audio_playing') };
  }
  const election = context.state.sheriffElection;
  if (election === undefined) {
    return { kind: 'rejected', error: handlerError('invalid_status') };
  }
  return { kind: 'allowed', election };
}

function getOccupiedSeats(state: GameState): number[] {
  return Object.entries(state.players)
    .filter(([, player]) => player !== null)
    .map(([seat]) => Number(seat))
    .sort((left, right) => left - right);
}

function getActiveCandidateSeats(election: SheriffElectionState): number[] {
  return election.registeredSeats.filter((seat) => !election.withdrawnSeats.includes(seat));
}

function createSheriffSpeakingOrder(state: GameState, candidateSeats: readonly number[]): number[] {
  const seatCount = Object.keys(state.players).length;
  const random = createSeededRng(state.roleRevealRandomNonce ?? state.roomCode);
  const startSeat = randomIntInclusive(1, seatCount, random) - 1;
  const directionStep = randomBool(random) ? 1 : -1;
  const candidateSeatSet = new Set(candidateSeats);
  const speakingOrder: number[] = [];

  for (let offset = 0; offset < seatCount; offset += 1) {
    const seat = (startSeat + directionStep * offset + seatCount) % seatCount;
    if (candidateSeatSet.has(seat)) speakingOrder.push(seat);
  }

  if (speakingOrder.length !== candidateSeats.length) {
    throw new Error('[FAIL-FAST] Sheriff candidates must map to unique table seats');
  }
  return speakingOrder;
}

function createAdvanceAction(election: SheriffElectionState): AdvanceSheriffElectionAction {
  return { type: 'ADVANCE_SHERIFF_ELECTION', payload: { election } };
}

function createCompleteAction(
  result: SheriffElectionResult,
  completedRound?: SheriffElectionRoundResult,
): CompleteSheriffElectionAction {
  return {
    type: 'COMPLETE_SHERIFF_ELECTION',
    payload: completedRound === undefined ? { result } : { result, completedRound },
  };
}

function hasEveryEligibleVote(election: VotingElectionState): boolean {
  return election.eligibleVoterSeats.every((seat) => Object.hasOwn(election.ballots, seat));
}

function closeVotingRound(election: VotingElectionState): SheriffElectionRoundResult {
  const voteCounts: Record<number, number> = {};
  for (const candidateSeat of election.candidateSeats) voteCounts[candidateSeat] = 0;

  const abstainingSeats: number[] = [];
  for (const voterSeat of election.eligibleVoterSeats) {
    const targetSeat = election.ballots[voterSeat];
    if (targetSeat === undefined) {
      throw new Error(`[FAIL-FAST] Missing sheriff ballot for eligible voter ${voterSeat}`);
    }
    if (targetSeat === null) {
      abstainingSeats.push(voterSeat);
      continue;
    }
    const currentCount = voteCounts[targetSeat];
    if (currentCount === undefined) {
      throw new Error(`[FAIL-FAST] Sheriff ballot targets non-candidate seat ${targetSeat}`);
    }
    voteCounts[targetSeat] = currentCount + 1;
  }

  return {
    round: election.phase === 'firstVote' ? 'first' : 'runoff',
    candidateSeats: election.candidateSeats,
    eligibleVoterSeats: election.eligibleVoterSeats,
    ballots: election.ballots,
    voteCounts,
    abstainingSeats,
  };
}

function getLeadingCandidateSeats(result: SheriffElectionRoundResult): number[] {
  const counts = Object.values(result.voteCounts);
  const highestVoteCount = Math.max(...counts);
  if (highestVoteCount === 0) return [];
  return result.candidateSeats.filter((seat) => result.voteCounts[seat] === highestVoteCount);
}

function startFirstSheriffVote(
  state: GameState,
  election: Extract<SheriffElectionState, { phase: 'candidateSpeech' | 'withdrawal' }>,
): StateAction {
  const activeCandidateSeats = getActiveCandidateSeats(election);
  if (activeCandidateSeats.length === 0) {
    return createCompleteAction({ kind: 'noSheriff', reason: 'noCandidates' });
  }
  if (activeCandidateSeats.length === 1) {
    return createCompleteAction({ kind: 'elected', sheriffSeat: activeCandidateSeats[0]! });
  }
  return createAdvanceAction({
    phase: 'firstVote',
    registeredSeats: election.registeredSeats,
    withdrawnSeats: election.withdrawnSeats,
    completedRounds: election.completedRounds,
    candidateSeats: activeCandidateSeats,
    eligibleVoterSeats: getOccupiedSeats(state).filter(
      (seat) => !election.registeredSeats.includes(seat),
    ),
    ballots: {},
  });
}

function advanceCandidateSpeech(
  state: GameState,
  election: Extract<SheriffElectionState, { phase: 'candidateSpeech' }>,
): StateAction {
  return startFirstSheriffVote(state, election);
}

function advanceRunoffSpeech(
  state: GameState,
  election: Extract<SheriffElectionState, { phase: 'runoffSpeech' }>,
): StateAction {
  const activeCandidateSeats = election.candidateSeats.filter(
    (seat) => !election.withdrawnSeats.includes(seat),
  );
  if (activeCandidateSeats.length === 0) {
    return createCompleteAction({ kind: 'noSheriff', reason: 'noCandidates' });
  }
  if (activeCandidateSeats.length === 1) {
    return createCompleteAction({ kind: 'elected', sheriffSeat: activeCandidateSeats[0]! });
  }
  const eligibleVoterSeats = getOccupiedSeats(state).filter(
    (seat) => !activeCandidateSeats.includes(seat),
  );
  return createAdvanceAction({
    phase: 'runoffVote',
    registeredSeats: election.registeredSeats,
    withdrawnSeats: election.withdrawnSeats,
    completedRounds: election.completedRounds,
    candidateSeats: activeCandidateSeats,
    eligibleVoterSeats,
    ballots: {},
  });
}

function closeFirstVote(
  state: GameState,
  election: Extract<SheriffElectionState, { phase: 'firstVote' }>,
): StateAction {
  const completedRound = closeVotingRound(election);
  const leadingCandidateSeats = getLeadingCandidateSeats(completedRound);
  if (leadingCandidateSeats.length === 0) {
    return createCompleteAction({ kind: 'noSheriff', reason: 'noVotes' }, completedRound);
  }
  if (leadingCandidateSeats.length === 1) {
    return createCompleteAction(
      { kind: 'elected', sheriffSeat: leadingCandidateSeats[0]! },
      completedRound,
    );
  }
  const speakingOrder = createSheriffSpeakingOrder(state, leadingCandidateSeats).reverse();
  return createAdvanceAction({
    phase: 'runoffSpeech',
    registeredSeats: election.registeredSeats,
    withdrawnSeats: election.withdrawnSeats,
    completedRounds: [...election.completedRounds, completedRound],
    candidateSeats: leadingCandidateSeats,
    speakingOrder,
  });
}

function closeRunoffVote(
  election: Extract<SheriffElectionState, { phase: 'runoffVote' }>,
): CompleteSheriffElectionAction {
  const completedRound = closeVotingRound(election);
  const leadingCandidateSeats = getLeadingCandidateSeats(completedRound);
  if (leadingCandidateSeats.length === 0) {
    return createCompleteAction({ kind: 'noSheriff', reason: 'noVotes' }, completedRound);
  }
  if (leadingCandidateSeats.length === 1) {
    return createCompleteAction(
      { kind: 'elected', sheriffSeat: leadingCandidateSeats[0]! },
      completedRound,
    );
  }
  return createCompleteAction({ kind: 'noSheriff', reason: 'runoffTie' }, completedRound);
}

/** @pre `state.status === GameStatus.Day` and election phase is registration. */
export function handleRegisterSheriffCandidate(
  intent: RegisterSheriffCandidateIntent,
  context: HandlerContext,
): HandlerResult {
  const gate = resolveSheriffElectionGate(context);
  if (gate.kind === 'rejected') return gate.error;
  const { election } = gate;
  if (election.phase !== 'registration') return handlerError('invalid_election_phase');
  if (election.registeredSeats.includes(intent.payload.seat)) {
    return handlerError('already_registered');
  }
  const action: RegisterSheriffCandidateAction = {
    type: 'REGISTER_SHERIFF_CANDIDATE',
    payload: { seat: intent.payload.seat },
  };
  return handlerSuccess([action]);
}

/** @pre `state.status === GameStatus.Day` and election phase is registration. */
export function handleCancelSheriffRegistration(
  intent: CancelSheriffRegistrationIntent,
  context: HandlerContext,
): HandlerResult {
  const gate = resolveSheriffElectionGate(context);
  if (gate.kind === 'rejected') return gate.error;
  const { election } = gate;
  if (election.phase !== 'registration') return handlerError('invalid_election_phase');
  if (!election.registeredSeats.includes(intent.payload.seat)) {
    return handlerError('not_candidate');
  }
  const action: CancelSheriffRegistrationAction = {
    type: 'CANCEL_SHERIFF_REGISTRATION',
    payload: { seat: intent.payload.seat },
  };
  return handlerSuccess([action]);
}

/** @pre `state.status === GameStatus.Day` and actor is an active candidate. */
export function handleWithdrawSheriffCandidate(
  intent: WithdrawSheriffCandidateIntent,
  context: HandlerContext,
): HandlerResult {
  const gate = resolveSheriffElectionGate(context);
  if (gate.kind === 'rejected') return gate.error;
  const { election } = gate;
  const canWithdraw =
    election.phase === 'candidateSpeech' ||
    election.phase === 'withdrawal' ||
    election.phase === 'runoffSpeech';
  if (!canWithdraw) return handlerError('invalid_election_phase');
  const isActiveRunoffCandidate =
    election.phase !== 'runoffSpeech' || election.candidateSeats.includes(intent.payload.seat);
  if (!election.registeredSeats.includes(intent.payload.seat) || !isActiveRunoffCandidate) {
    return handlerError('not_candidate');
  }
  if (election.withdrawnSeats.includes(intent.payload.seat)) {
    return handlerError('already_withdrawn');
  }
  const action: WithdrawSheriffCandidateAction = {
    type: 'WITHDRAW_SHERIFF_CANDIDATE',
    payload: { seat: intent.payload.seat },
  };
  return handlerSuccess([action]);
}

/** @pre `state.status === GameStatus.Day` and election is in a voting phase. */
export function handleCastSheriffVote(
  intent: CastSheriffVoteIntent,
  context: HandlerContext,
): HandlerResult {
  const gate = resolveSheriffElectionGate(context);
  if (gate.kind === 'rejected') return gate.error;
  const { election } = gate;
  if (election.phase !== 'firstVote' && election.phase !== 'runoffVote') {
    return handlerError('invalid_election_phase');
  }
  if (!election.eligibleVoterSeats.includes(intent.payload.voterSeat)) {
    return handlerError('not_eligible_voter');
  }
  if (
    intent.payload.targetSeat !== null &&
    !election.candidateSeats.includes(intent.payload.targetSeat)
  ) {
    return handlerError('invalid_vote_target');
  }
  const action: CastSheriffVoteAction = {
    type: 'CAST_SHERIFF_VOTE',
    payload: intent.payload,
  };
  return handlerSuccess([action]);
}

/** @pre `state.status === GameStatus.Day` and actor is Host. */
export function handleAdvanceSheriffElection(
  _intent: AdvanceSheriffElectionIntent,
  context: HandlerContext,
): HandlerResult {
  const gate = resolveSheriffElectionGate(context);
  if (gate.kind === 'rejected') return gate.error;
  const { election } = gate;

  let action: StateAction;
  switch (election.phase) {
    case 'registration': {
      const candidateSeats = getActiveCandidateSeats(election);
      if (candidateSeats.length === 0) {
        action = createCompleteAction({ kind: 'noSheriff', reason: 'noCandidates' });
        break;
      }
      action = createAdvanceAction({
        phase: 'candidateSpeech',
        registeredSeats: election.registeredSeats,
        withdrawnSeats: election.withdrawnSeats,
        completedRounds: election.completedRounds,
        speakingOrder: createSheriffSpeakingOrder(context.state, candidateSeats),
      });
      break;
    }
    case 'candidateSpeech':
      action = advanceCandidateSpeech(context.state, election);
      break;
    case 'withdrawal':
      action = startFirstSheriffVote(context.state, election);
      break;
    case 'firstVote':
      if (!hasEveryEligibleVote(election)) return handlerError('pending_votes');
      action = closeFirstVote(context.state, election);
      break;
    case 'runoffSpeech':
      action = advanceRunoffSpeech(context.state, election);
      break;
    case 'runoffVote':
      if (!hasEveryEligibleVote(election)) return handlerError('pending_votes');
      action = closeRunoffVote(election);
      break;
    case 'completed':
      return handlerError('invalid_election_phase');
  }
  return handlerSuccess([action]);
}

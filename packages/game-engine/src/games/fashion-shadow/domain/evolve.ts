// Pure event evolution for Fashion Shadow.

import type { FashionHumanSeat, FashionRound, FashionState } from '../state/types';
import type { FashionEvent } from './events';

function getNextFashionRound(round: FashionRound): FashionRound | null {
  switch (round) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
      return null;
  }
}

function applyFashionSeatChanges(
  seats: FashionState['realSeats'],
  changes: Extract<FashionEvent, { readonly type: 'fashion.seats.changed' }>['changes'],
): FashionState['realSeats'] {
  const next: Record<number, FashionHumanSeat | undefined> = { ...seats };
  for (const change of changes) {
    if (change.next === null) {
      delete next[change.seat];
    } else {
      next[change.seat] = change.next;
    }
  }
  return next;
}

export function evolveFashionState(state: FashionState, event: FashionEvent): FashionState {
  switch (event.type) {
    case 'fashion.seats.changed':
      return { ...state, realSeats: applyFashionSeatChanges(state.realSeats, event.changes) };
    case 'fashion.profile.updated': {
      const occupant = state.realSeats[event.seat];
      if (occupant === undefined) {
        throw new Error(`Fashion profile update targets empty seat ${event.seat}`);
      }
      return {
        ...state,
        realSeats: {
          ...state.realSeats,
          [event.seat]: {
            ...occupant,
            profile: { ...occupant.profile, ...event.profile },
          },
        },
      };
    }
    case 'fashion.game.started':
      return {
        ...state,
        phase: 'roleReveal',
        roles: { ...event.roles },
        secrets: { ...event.secrets },
        roleConfirmedSeats: [],
        actionTokens: { ...event.actionTokens },
        currentEvent: null,
        votes: {},
        discussionSpeakCounts: {},
        interrogation: null,
        crossExamParticipantSeats: [],
        crossExamAwardVotes: {},
      };
    case 'fashion.role.confirmed':
      return {
        ...state,
        roleConfirmedSeats: [...state.roleConfirmedSeats, event.seat].sort(
          (left, right) => left - right,
        ),
      };
    case 'fashion.event.revealed':
      return { ...state, phase: 'event', currentEvent: event.eventId };
    case 'fashion.secret.revealed':
      return {
        ...state,
        revealedSecrets: { ...state.revealedSecrets, [event.seat]: event.secretId },
      };
    case 'fashion.crossExam.started':
      return {
        ...state,
        phase: 'crossExamination',
        actionTokens: {
          ...state.actionTokens,
          ...(event.participantSeats.includes(event.attackerSeat)
            ? { [event.attackerSeat]: state.actionTokens[event.attackerSeat]! - 1 }
            : {}),
          ...(event.participantSeats.includes(event.defenderSeat)
            ? { [event.defenderSeat]: state.actionTokens[event.defenderSeat]! - 1 }
            : {}),
        },
        crossExamParticipantSeats: [
          ...new Set([...state.crossExamParticipantSeats, ...event.participantSeats]),
        ].sort((left, right) => left - right),
        interrogation: {
          match: event.match,
          attackerSeat: event.attackerSeat,
          defenderSeat: event.defenderSeat,
          participantSeats: [...event.participantSeats],
          startedAt: event.startedAt,
          endsAt: event.endsAt,
        },
      };
    case 'fashion.crossExam.awardVoted':
      return {
        ...state,
        crossExamAwardVotes: {
          ...state.crossExamAwardVotes,
          [event.voterSeat]: event.candidateSeat,
        },
      };
    case 'fashion.crossExam.awarded':
      return { ...state, crossExamAwards: [...state.crossExamAwards, event.award] };
    case 'fashion.crossExam.finished':
      return { ...state, phase: 'discussion', interrogation: null, discussionSpeakCounts: {} };
    case 'fashion.discussion.spoken':
      return {
        ...state,
        actionTokens: {
          ...state.actionTokens,
          [event.seat]: state.actionTokens[event.seat]! - 1,
        },
        discussionSpeakCounts: {
          ...state.discussionSpeakCounts,
          [event.seat]: (state.discussionSpeakCounts[event.seat] ?? 0) + 1,
        },
      };
    case 'fashion.discussion.finished':
      return { ...state, phase: 'vote', votes: {} };
    case 'fashion.vote.cast':
      return {
        ...state,
        votes: { ...state.votes, [event.seat]: event.vote },
        investigationVoteHistory: [
          ...state.investigationVoteHistory,
          { round: state.currentRound, seat: event.seat, vote: event.vote },
        ],
      };
    case 'fashion.vote.finished':
      return {
        ...state,
        phase: 'roundTransition',
        publicEvidence: event.approved
          ? [...state.publicEvidence, event.evidenceId]
          : state.publicEvidence,
        destroyedEvidence: event.approved
          ? state.destroyedEvidence
          : [...state.destroyedEvidence, event.evidenceId],
      };
    case 'fashion.round.advanced':
      return {
        ...state,
        currentRound: event.round,
        phase: 'event',
        currentEvent: event.eventId,
        votes: {},
        discussionSpeakCounts: {},
        crossExamParticipantSeats: [],
        crossExamAwardVotes: {},
      };
    case 'fashion.hearing.started':
      return { ...state, phase: 'hearing', finalVotes: {} };
    case 'fashion.contract.proposed':
      return {
        ...state,
        actionTokens: {
          ...state.actionTokens,
          [event.contract.sellerSeat]: state.actionTokens[event.contract.sellerSeat]! - 1,
        },
        contracts: [...state.contracts, event.contract],
      };
    case 'fashion.contract.accepted':
      return {
        ...state,
        contracts: state.contracts.map((contract) =>
          contract.id === event.contractId ? { ...contract, status: 'accepted' } : contract,
        ),
      };
    case 'fashion.contract.fulfilled':
      return {
        ...state,
        contracts: state.contracts.map((contract) =>
          contract.id === event.contractId ? { ...contract, status: 'fulfilled' } : contract,
        ),
      };
    case 'fashion.identityGuess.cast': {
      const blockedRound = getNextFashionRound(state.currentRound);
      return {
        ...state,
        actionTokens: {
          ...state.actionTokens,
          [event.guesserSeat]: state.actionTokens[event.guesserSeat]! - 1,
        },
        revealedSecrets:
          event.success && event.revealedSecretId !== null
            ? { ...state.revealedSecrets, [event.targetSeat]: event.revealedSecretId }
            : state.revealedSecrets,
        identityGuessPenalties:
          event.success || blockedRound === null
            ? state.identityGuessPenalties
            : [...state.identityGuessPenalties, { seat: event.guesserSeat, blockedRound }],
        identityGuessHistory: [
          ...state.identityGuessHistory,
          {
            guesserSeat: event.guesserSeat,
            targetSeat: event.targetSeat,
            round: state.currentRound,
          },
        ],
      };
    }
    case 'fashion.hearing.vote':
      return {
        ...state,
        finalVotes: { ...state.finalVotes, [event.seat]: event.targetSeat },
      };
    case 'fashion.hearing.finished':
      return { ...state, phase: 'ended', winners: [...event.winners] };
  }
  const exhaustive: never = event;
  return exhaustive;
}

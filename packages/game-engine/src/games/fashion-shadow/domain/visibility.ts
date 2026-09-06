// Per-user Fashion Shadow projection that never exposes another player's secret identity.

import { findSeatByUserId } from '../../../platform/room/seating';
import type {
  FashionCrossExamAward,
  FashionEventId,
  FashionEvidenceId,
  FashionHumanSeat,
  FashionInterrogation,
  FashionPhase,
  FashionRoleId,
  FashionSecretId,
  FashionState,
} from '../state/types';
import { FASHION_ROLE_BY_ID, FASHION_ROUND_BY_NUMBER } from './content';

export interface FashionPrivateIdentityView {
  readonly seat: number;
  readonly roleId: FashionRoleId;
  readonly roleName: string;
  readonly publicStance: string;
  readonly secretId: FashionSecretId;
  readonly secret: string;
  readonly victoryCondition: string;
}

export interface FashionPublicState {
  readonly gameType: 'fashion-shadow';
  readonly stateVersion: number;
  readonly roomCode: string;
  readonly hostUserId: string;
  readonly phase: FashionPhase;
  readonly currentRound: 1 | 2 | 3 | 4;
  readonly numberOfPlayers: 7;
  readonly realSeats: Readonly<Record<number, FashionHumanSeat | undefined>>;
  readonly roleConfirmedSeats: readonly number[];
  readonly actionTokens: Readonly<Record<number, number>>;
  readonly currentEvent: FashionEventId | null;
  readonly currentEventTitle: string | null;
  readonly voteQuestion: string | null;
  readonly publicEvidence: readonly FashionEvidenceId[];
  readonly destroyedEvidence: readonly FashionEvidenceId[];
  readonly revealedSecrets: Readonly<Record<number, FashionSecretId>>;
  readonly crossExamAwards: readonly FashionCrossExamAward[];
  readonly votedSeats: readonly number[];
  readonly finalVotedSeats: readonly number[];
  readonly discussionSpeakCounts: Readonly<Record<number, number>>;
  readonly interrogation: FashionInterrogation | null;
  readonly winners: readonly number[];
  readonly privateIdentity: FashionPrivateIdentityView | null;
}

export function getFashionUserSeat(state: FashionState, userId: string): number | null {
  return findSeatByUserId(state.realSeats, state.numberOfPlayers, userId);
}

export function getFashionPublicState(
  state: FashionState,
  userId: string | null,
): FashionPublicState {
  const viewerSeat = userId === null ? null : getFashionUserSeat(state, userId);
  const roleId = viewerSeat === null ? undefined : state.roles[viewerSeat];
  const secretId = viewerSeat === null ? undefined : state.secrets[viewerSeat];
  const role = roleId === undefined ? undefined : FASHION_ROLE_BY_ID[roleId];
  const round = FASHION_ROUND_BY_NUMBER[state.currentRound];

  return {
    gameType: 'fashion-shadow',
    stateVersion: state.stateVersion,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    phase: state.phase,
    currentRound: state.currentRound,
    numberOfPlayers: state.numberOfPlayers,
    realSeats: state.realSeats,
    roleConfirmedSeats: state.roleConfirmedSeats,
    actionTokens: state.actionTokens,
    currentEvent: state.currentEvent,
    currentEventTitle: state.currentEvent === null ? null : round.eventTitle,
    voteQuestion: state.currentEvent === null ? null : round.voteQuestion,
    publicEvidence: state.publicEvidence,
    destroyedEvidence: state.destroyedEvidence,
    revealedSecrets: state.revealedSecrets,
    crossExamAwards: state.crossExamAwards,
    votedSeats: Object.keys(state.votes)
      .map(Number)
      .sort((left, right) => left - right),
    finalVotedSeats: Object.keys(state.finalVotes)
      .map(Number)
      .sort((left, right) => left - right),
    discussionSpeakCounts: state.discussionSpeakCounts,
    interrogation: state.interrogation,
    winners: state.winners,
    privateIdentity:
      viewerSeat === null || roleId === undefined || role === undefined || secretId === undefined
        ? null
        : {
            seat: viewerSeat,
            roleId,
            roleName: role.name,
            publicStance: role.publicStance,
            secretId,
            secret: role.secret,
            victoryCondition: role.victoryCondition,
          },
  };
}

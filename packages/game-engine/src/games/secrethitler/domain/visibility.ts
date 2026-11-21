/** Secrethitler per-seat view model: private state is cropped for its authorized viewer. */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { listUnviewedSeats } from '../../../platform/room/identityViewing';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import {
  getSecrethitlerViewingParticipants,
  isSecrethitlerOccupiedSeat,
  type SecrethitlerPhaseKind,
  type SecrethitlerPolicy,
  type SecrethitlerPublicHistory,
  type SecrethitlerState,
  type SecrethitlerVote,
  type SecrethitlerVoteMode,
} from '../state/types';
import {
  getKnownFascistSeats,
  getSecrethitlerNightParticipants,
  tallySecrethitlerVotes,
} from './rules';

export interface SecrethitlerSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  /** 终局揭晓前为 null。 */
  readonly identity: string | null;
}

export interface SecrethitlerGovernmentView {
  readonly presidentSeat: number;
  readonly chancellorSeat: number;
  readonly outcome: 'pending' | 'passed' | 'rejected';
  readonly votes: readonly { readonly seat: number; readonly vote: SecrethitlerVote }[] | null;
  readonly voteCounts: {
    readonly ja: number;
    readonly nein: number;
  } | null;
}

export interface SecrethitlerHistoryView {
  readonly governments: readonly SecrethitlerGovernmentView[];
  readonly policies: SecrethitlerPublicHistory['policies'];
  readonly actions: SecrethitlerPublicHistory['actions'];
}

export interface SecrethitlerViewModel {
  readonly phase: SecrethitlerPhaseKind;
  readonly phaseStep: number | null;
  readonly mySeat: number | null;
  readonly myIdentity: string | null;
  readonly seats: readonly SecrethitlerSeatView[];
  readonly hasViewedRole: boolean;
  readonly unviewedRoleSeats: readonly number[];
  readonly livingSeats: readonly number[];
  readonly presidentSeat: number | null;
  readonly chancellorSeat: number | null;
  readonly eligibleChancellorSeats: readonly number[];
  readonly myVote: SecrethitlerVote | null;
  readonly myHand: readonly SecrethitlerPolicy[] | null;
  readonly policyPreview: readonly SecrethitlerPolicy[] | null;
  readonly knownFascistSeats: readonly number[];
  readonly knownFascists: readonly {
    readonly seat: number;
    readonly identity: 'fascist' | 'hitler';
  }[];
  readonly canConfirmNight: boolean;
  readonly hasConfirmedNight: boolean;
  readonly canRequestVeto: boolean;
  readonly myInvestigation: {
    readonly targetSeat: number;
    readonly faction: 'liberal' | 'fascist';
  } | null;
  readonly electionTracker: number;
  readonly liberalPolicies: number;
  readonly fascistPolicies: number;
  readonly vetoUnlocked: boolean;
  readonly lastPresidentSeat: number | null;
  readonly lastChancellorSeat: number | null;
  readonly voteMode: SecrethitlerVoteMode;
  readonly publicVoteResult: {
    readonly yesCount: number;
    readonly noCount: number;
    readonly passed: boolean;
    readonly votes: readonly { readonly seat: number; readonly vote: SecrethitlerVote }[] | null;
  } | null;
  readonly history: SecrethitlerHistoryView;
  readonly winner: 'liberal' | 'fascist' | null;
  readonly endReason:
    'liberalPolicies' | 'hitlerExecuted' | 'fascistPolicies' | 'hitlerElected' | null;
}

function currentPresident(state: SecrethitlerState): number | null {
  const { phase } = state;
  if (phase.kind === 'publicResult') return phase.previous.presidentSeat;
  if (
    phase.kind === 'election' ||
    phase.kind === 'voting' ||
    phase.kind === 'legislativePresident' ||
    phase.kind === 'legislativeChancellor' ||
    phase.kind === 'vetoResponse' ||
    phase.kind === 'executive' ||
    phase.kind === 'investigationResult'
  )
    return phase.presidentSeat;
  return null;
}

function currentChancellor(state: SecrethitlerState): number | null {
  const { phase } = state;
  if (phase.kind === 'publicResult') return phase.previous.chancellorSeat;
  if (
    phase.kind === 'voting' ||
    phase.kind === 'legislativePresident' ||
    phase.kind === 'legislativeChancellor' ||
    phase.kind === 'vetoResponse'
  )
    return phase.chancellorSeat;
  return null;
}

function ownHand(
  state: SecrethitlerState,
  viewerSeat: number | null,
): readonly SecrethitlerPolicy[] | null {
  if (viewerSeat === null) return null;
  const { phase } = state;
  if (phase.kind === 'legislativePresident' && viewerSeat === phase.presidentSeat)
    return phase.hand;
  if (
    (phase.kind === 'legislativeChancellor' || phase.kind === 'vetoResponse') &&
    viewerSeat === phase.chancellorSeat
  )
    return phase.hand;
  return null;
}

function allowedChancellors(state: SecrethitlerState): readonly number[] {
  const president = currentPresident(state);
  if (president === null) return [];
  return state.livingSeats.filter(
    (seat) =>
      seat !== president &&
      seat !== state.lastChancellorSeat &&
      (state.livingSeats.length <= 5 || seat !== state.lastPresidentSeat),
  );
}

function publicHistory(state: SecrethitlerState): SecrethitlerHistoryView {
  return {
    governments: state.history.governments.map((record) => ({
      presidentSeat: record.presidentSeat,
      chancellorSeat: record.chancellorSeat,
      outcome: record.outcome,
      votes: state.config.voteMode === 'public' ? record.votes : null,
      voteCounts:
        record.votes === null
          ? null
          : {
              ja: record.votes.filter(({ vote }) => vote === 'ja').length,
              nein: record.votes.filter(({ vote }) => vote === 'nein').length,
            },
    })),
    policies: state.history.policies,
    actions: state.history.actions,
  };
}

function getPublicVoteResult(state: SecrethitlerState): SecrethitlerViewModel['publicVoteResult'] {
  if (state.phase.kind !== 'publicResult') return null;
  const previous = state.phase.previous;
  if (previous.kind !== 'voting') return null;
  const tally = tallySecrethitlerVotes(state.livingSeats, previous.votes);
  return {
    yesCount: tally.yesCount,
    noCount: tally.noCount,
    passed: tally.passed,
    votes: state.config.voteMode === 'public' ? tally.votes : null,
  };
}

/**
 * Builds a viewer-cropped projection. Secret ballots, unrevealed legislative
 * hands, faction lists, investigation results and policy previews never cross
 * this boundary.
 */
export function getSecrethitlerViewModel(
  state: SecrethitlerState,
  viewerSeat: number | null,
): SecrethitlerViewModel {
  const revealed = state.phase.kind === 'ended';
  const seats: SecrethitlerSeatView[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (!isSecrethitlerOccupiedSeat(state, seat)) continue;
    seats.push({
      ...buildSeatIdentityView(state.roster, seat, getBotDisplayName),
      identity: revealed ? (state.identities[seat] ?? null) : null,
    });
  }
  const myVote =
    state.phase.kind === 'voting' && viewerSeat !== null
      ? (state.phase.votes[viewerSeat] ?? null)
      : null;
  const myInvestigation =
    state.phase.kind === 'investigationResult' &&
    state.lastInvestigation?.presidentSeat === viewerSeat
      ? {
          targetSeat: state.lastInvestigation.targetSeat,
          faction: state.lastInvestigation.faction,
        }
      : null;
  const nightInfo =
    state.phase.kind === 'night' && state.phase.step === 1 && viewerSeat !== null
      ? getKnownFascistSeats(state, viewerSeat)
      : [];
  const phaseStep = state.phase.kind === 'night' ? state.phase.step : null;
  return {
    phase: state.phase.kind,
    phaseStep,
    mySeat: viewerSeat,
    myIdentity: viewerSeat === null ? null : (state.identities[viewerSeat] ?? null),
    seats,
    hasViewedRole: viewerSeat !== null && state.roleViewedSeats.includes(viewerSeat),
    unviewedRoleSeats: listUnviewedSeats(
      getSecrethitlerViewingParticipants(state),
      state.roleViewedSeats,
    ).map((participant) => participant.seat),
    livingSeats: state.livingSeats,
    presidentSeat: currentPresident(state),
    chancellorSeat: currentChancellor(state),
    eligibleChancellorSeats: allowedChancellors(state),
    myVote,
    myHand: ownHand(state, viewerSeat),
    policyPreview:
      state.phase.kind === 'executive' &&
      state.phase.power === 'policyPeek' &&
      viewerSeat === state.phase.presidentSeat
        ? state.phase.preview
        : null,
    knownFascistSeats: nightInfo,
    knownFascists: nightInfo.map((seat) => {
      const identity = state.identities[seat];
      if (identity !== 'fascist' && identity !== 'hitler')
        throw new Error('Invalid authorized fascist identity');
      return { seat, identity };
    }),
    canConfirmNight:
      state.phase.kind === 'night' &&
      state.phase.step === 1 &&
      viewerSeat !== null &&
      getSecrethitlerNightParticipants(state).includes(viewerSeat),
    hasConfirmedNight:
      state.phase.kind === 'night' &&
      viewerSeat !== null &&
      state.phase.confirmedSeats.includes(viewerSeat),
    canRequestVeto:
      state.phase.kind === 'legislativeChancellor' &&
      viewerSeat === state.phase.chancellorSeat &&
      state.fascistPolicies >= 5 &&
      !state.phase.vetoRejected,
    myInvestigation,
    electionTracker: state.electionTracker,
    liberalPolicies: state.liberalPolicies,
    fascistPolicies: state.fascistPolicies,
    vetoUnlocked: state.fascistPolicies >= 5,
    lastPresidentSeat: state.lastPresidentSeat,
    lastChancellorSeat: state.lastChancellorSeat,
    voteMode: state.config.voteMode,
    publicVoteResult: getPublicVoteResult(state),
    history: publicHistory(state),
    winner: state.phase.kind === 'ended' ? state.phase.winner : null,
    endReason: state.phase.kind === 'ended' ? state.phase.reason : null,
  };
}

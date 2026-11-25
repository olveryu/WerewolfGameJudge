/**
 * The public sheriff-election record as the night report shows it, projected from the shared
 * election record. The report never publishes more than the election panel does.
 */

import type {
  GameState,
  Player,
  SheriffElectionResult,
  SheriffElectionState,
  SheriffSpeakingDirection,
} from '../protocol/types';
import {
  deriveSheriffRoundRecord,
  getSheriffCandidateRecords,
  getSheriffVoteProgress,
  type SheriffRoundRecord,
  type SheriffVoteProgress,
} from './sheriffElectionRecord';

function playerAt(players: GameState['players'], seat: number): Player | null {
  return players[seat] ?? null;
}

/**
 * One closed sheriff-election voting round in the report. The tally itself
 * is defined once in sheriffElectionRecord; this is only the report's
 * surface name for that record, never a second definition.
 */
export type NightReviewSheriffRound = SheriffRoundRecord;

/**
 * The sheriff-election section of the night report, derived from
 * `sheriffElection` + `sheriffElectionResult`. The report never publishes
 * more than the public election record (the sheriffElectionViewModel
 * convention):
 * during `registration` the section is status-only — candidate identities
 * and counts stay secret from everyone, the host included — and a round
 * that is still collecting ballots contributes its candidates but never
 * any ballot content.
 */
export type NightReviewSheriffSection =
  | { readonly kind: 'registration' }
  | {
      readonly kind: 'inProgress';
      /** Election phase, so the report renders the panel's phase titles. */
      readonly phase: SheriffElectionState['phase'];
      /** Full registration, so the report renders the panel's 上警 row. */
      readonly registeredSeats: readonly number[];
      /** Public candidates for the current stage (see derivation). */
      readonly candidateSeats: readonly number[];
      readonly withdrawnSeats: readonly number[];
      readonly closedRounds: readonly NightReviewSheriffRound[];
      /** The round currently collecting ballots, when in a voting stage. */
      readonly activeRound: {
        readonly round: 'first' | 'runoff';
        readonly candidateSeats: readonly number[];
      } | null;
      /**
       * Where speeches start and in which direction. Null outside speech
       * phases, so the row never renders there — exactly the panel's rule.
       */
      readonly speakingOrder: {
        readonly startSeat: number;
        readonly direction: SheriffSpeakingDirection;
      } | null;
      /**
       * Submission counts and pending seats for an open voting round (the
       * panel's public slice: counts and pending seats only, never ballot
       * targets). Null outside voting.
       */
      readonly voteProgress: SheriffVoteProgress | null;
    }
  | {
      readonly kind: 'completed';
      readonly registeredSeats: readonly number[];
      readonly withdrawnSeats: readonly number[];
      /** Still-standing candidates, so the report renders the panel's records. */
      readonly activeCandidateSeats: readonly number[];
      readonly rounds: readonly NightReviewSheriffRound[];
      readonly result: SheriffElectionResult;
    };

/**
 * Project the report's sheriff section from the shared election record
 * (sheriffElectionRecord) — the same record the election panel publishes.
 * This function owns only the report's own shape: which record fields land
 * in which section kind. It never re-derives a tally or a candidate set.
 * Registration exposes nothing but the status; speech stages expose the
 * active candidates; a voting stage exposes the closed rounds in full plus
 * the active round's candidates and the submission counts — its ballot
 * targets are never read here. The in-progress section also carries the
 * phase and the full registration so the report can render the panel's
 * phase header and records rows without re-deriving them.
 */
function deriveSpeakingOrder(
  state: GameState,
  election: SheriffElectionState,
): { readonly startSeat: number; readonly direction: SheriffSpeakingDirection } | null {
  if (election.phase !== 'candidateSpeech' && election.phase !== 'runoffSpeech') return null;
  if (playerAt(state.players, election.speakingStartSeat) === null) {
    throw new Error(
      `[FAIL-FAST] Sheriff speaking start seat ${election.speakingStartSeat} is not occupied`,
    );
  }
  return { startSeat: election.speakingStartSeat, direction: election.speakingDirection };
}

export function deriveSheriffSection(state: GameState): NightReviewSheriffSection | undefined {
  const election = state.sheriffElection;
  const result = state.sheriffElectionResult;
  if (election === undefined) {
    if (result !== undefined) {
      throw new Error(
        '[FAIL-FAST] Sheriff election result exists without an election state in night review',
      );
    }
    return undefined;
  }
  if (election.phase === 'registration') {
    return { kind: 'registration' };
  }
  const records = getSheriffCandidateRecords(election);
  if (records === null) {
    throw new Error(
      '[FAIL-FAST] Sheriff election records are missing outside registration in night review',
    );
  }
  switch (election.phase) {
    case 'candidateSpeech':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: [],
        activeRound: null,
        voteProgress: null,
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'firstVote':
    case 'runoffVote':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: election.completedRounds.map(deriveSheriffRoundRecord),
        activeRound: {
          round: election.phase === 'firstVote' ? 'first' : 'runoff',
          candidateSeats: [...records.activeCandidateSeats],
        },
        voteProgress: getSheriffVoteProgress(election),
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'runoffSpeech':
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: election.completedRounds.map(deriveSheriffRoundRecord),
        activeRound: null,
        voteProgress: null,
        speakingOrder: deriveSpeakingOrder(state, election),
      };
    case 'result':
      if (election.next.kind === 'final') {
        return {
          kind: 'completed',
          registeredSeats: [...records.registeredSeats],
          withdrawnSeats: [...records.withdrawnSeats],
          activeCandidateSeats: [...records.activeCandidateSeats],
          rounds: election.completedRounds.map(deriveSheriffRoundRecord),
          result: election.next.result,
        };
      }
      return {
        kind: 'inProgress',
        phase: election.phase,
        registeredSeats: [...records.registeredSeats],
        candidateSeats: [...records.activeCandidateSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        closedRounds: election.completedRounds.map(deriveSheriffRoundRecord),
        activeRound: null,
        voteProgress: null,
        speakingOrder: null,
      };
    case 'completed': {
      if (result === undefined) {
        throw new Error(
          '[FAIL-FAST] Sheriff election is completed without a result in night review',
        );
      }
      return {
        kind: 'completed',
        registeredSeats: [...records.registeredSeats],
        withdrawnSeats: [...records.withdrawnSeats],
        activeCandidateSeats: [...records.activeCandidateSeats],
        rounds: election.completedRounds.map(deriveSheriffRoundRecord),
        result,
      };
    }
  }
}

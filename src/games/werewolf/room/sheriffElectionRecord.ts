/**
 * Sheriff-election public record — the single derivation shared by the
 * election panel (sheriffElectionViewModel) and the night report
 * (NightReview.helpers).
 *
 * Pure functions only: no React, no styles, no gameState access. The panel
 * shell keeps its own occupied-seat assertions around these derivations;
 * this module never sees a player roster.
 *
 * Two facts are derived here and nowhere else:
 * - one closed round's tally, re-derived from its ballots alone (stored
 *   voteCounts / abstainingSeats are cross-checks only, any mismatch fails
 *   fast);
 * - the per-phase candidate records (registered / withdrawn / active),
 *   which are the panel's record model and the report's projection source.
 * The report never publishes more than this record: during `registration`
 * the records are null and the report shows a status only.
 */

import type {
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';

/**
 * One closed sheriff-election voting round, re-derived from the round's
 * ballots alone: each candidate's votes and voter seats are counted from
 * `ballots`; the stored `voteCounts` / `abstainingSeats` are only ever used
 * as a cross-check (a mismatch fails fast in the derivation). Seats are
 * 0-based; candidates, voter seats and abstaining seats are all in seat
 * order.
 */
export interface SheriffRoundRecord {
  readonly round: 'first' | 'runoff';
  readonly perCandidate: readonly {
    readonly seat: number;
    readonly votes: number;
    readonly voterSeats: readonly number[];
  }[];
  readonly abstainingSeats: readonly number[];
}

/**
 * The election's candidate records for one phase: every seat that
 * registered, every seat that withdrew, and the seats still standing as
 * candidates. Null while registration identities are not yet public.
 */
export interface SheriffCandidateRecords {
  readonly registeredSeats: readonly number[];
  readonly withdrawnSeats: readonly number[];
  readonly activeCandidateSeats: readonly number[];
}

function sameSeatSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((seat) => bSet.has(seat));
}

/**
 * Re-derive one closed round's public tally from its ballots alone. The
 * stored voteCounts / abstainingSeats are cross-checks only: any mismatch
 * with the ballot-derived tally is a corrupt record and fails fast, exactly
 * like the election view model refuses to render a round whose stored
 * counts are incomplete.
 */
export function deriveSheriffRoundRecord(round: SheriffElectionRoundResult): SheriffRoundRecord {
  const ballots = new Map<number, number | null>();
  for (const voterSeat of round.eligibleVoterSeats) {
    const ballot = round.ballots[voterSeat];
    if (ballot === undefined) {
      throw new Error(
        `[FAIL-FAST] Sheriff round ${round.round} has no ballot for eligible voter ${voterSeat}`,
      );
    }
    ballots.set(voterSeat, ballot);
  }
  const perCandidate = [...round.candidateSeats]
    .sort((a, b) => a - b)
    .map((seat) => {
      const voterSeats = round.eligibleVoterSeats
        .filter((voterSeat) => ballots.get(voterSeat) === seat)
        .sort((a, b) => a - b);
      const storedCount = round.voteCounts[seat];
      if (storedCount === undefined) {
        throw new Error(
          `[FAIL-FAST] Sheriff round ${round.round} has no stored vote count for candidate ${seat}`,
        );
      }
      if (storedCount !== voterSeats.length) {
        throw new Error(
          `[FAIL-FAST] Sheriff round ${round.round} stored vote count ${storedCount} for candidate ${seat} disagrees with its ballots (${voterSeats.length})`,
        );
      }
      return { seat, votes: voterSeats.length, voterSeats };
    });
  const abstainingSeats = round.eligibleVoterSeats
    .filter((voterSeat) => ballots.get(voterSeat) === null)
    .sort((a, b) => a - b);
  if (!sameSeatSet(abstainingSeats, round.abstainingSeats)) {
    throw new Error(
      `[FAIL-FAST] Sheriff round ${round.round} stored abstaining seats disagree with its ballots`,
    );
  }
  return { round: round.round, perCandidate, abstainingSeats };
}

function getActiveCandidateSeats(election: SheriffElectionState): readonly number[] {
  switch (election.phase) {
    case 'firstVote':
    case 'runoffVote':
      return election.candidateSeats;
    case 'runoffSpeech':
      return election.candidateSeats.filter((seat) => !election.withdrawnSeats.includes(seat));
    case 'registration':
    case 'candidateSpeech':
    case 'withdrawal':
    case 'completed':
      return election.registeredSeats.filter((seat) => !election.withdrawnSeats.includes(seat));
  }
}

/**
 * The election's candidate records for its current phase. Null while
 * registration identities are not yet public — callers must render a
 * status only and never read registeredSeats in that phase.
 */
export function getSheriffCandidateRecords(
  election: SheriffElectionState,
): SheriffCandidateRecords | null {
  if (election.phase === 'registration') return null;
  return {
    registeredSeats: election.registeredSeats,
    withdrawnSeats: election.withdrawnSeats,
    activeCandidateSeats: getActiveCandidateSeats(election),
  };
}

/**
 * Sheriff-election presentation projection: the one place that decides
 * which public election rows exist, in which order, and who is marked
 * as the winner.
 *
 * This is the presentation layer of the extraction, not a third copy of
 * the election record. The tally and the candidate records are still
 * derived once in the engine (`sheriffElectionRecord`) and reach here
 * through the caller's view model or report section; this module only
 * decides how that public record is presented, and both surfaces — the
 * election panel (`SheriffElectionReadOnly`) and the night review
 * (`toWerewolfReviewDocument`) — render these rows, each in its own
 * vocabulary. A row carries semantic flags only (isWinner, isWithdrawn,
 * isEmpty); it carries no React, no styles, no colors, and no
 * `Review*` types, so a pure-data document can consume it.
 *
 * The two thin adapters (`FromView` / `FromSection`) only move fields.
 * They must never grow a decision: no phase, result, or seat-set
 * branching lives in them, only in `createSheriffElectionPresentation`.
 */

import type {
  NightReviewSheriffSection,
  SheriffCandidateRecords,
  SheriffElectionResult,
  SheriffElectionState,
  SheriffRoundRecord,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  formatSheriffElectedLine,
  formatSpeakingOrder,
  getNoSheriffText,
  getSheriffElectionRoundTitle,
  SHERIFF_ELECTION_PHASE_CONTENT,
  type SheriffElectionViewModel,
} from '@/games/werewolf/room/day/sheriffElectionViewModel';

export interface SheriffElectionPresentationRoundInput {
  readonly key: SheriffRoundRecord['round'];
  readonly perCandidate: SheriffRoundRecord['perCandidate'];
  readonly abstainingSeats: readonly number[];
}

/**
 * Normalized input: the caller supplies the already-derived public
 * record, never a live game state. The panel passes its view model
 * fields; the review passes its section fields.
 */
export interface SheriffElectionPresentationInput {
  readonly phase: SheriffElectionState['phase'];
  /**
   * The phase description, supplied by the caller — never derived here.
   * The panel passes its view model's description, which is the host
   * variant (`报名截止后，请在「主持管理」中结束报名。`) for the host
   * during registration; the review passes the generic description,
   * because the archive is read-only and host instructions do not
   * belong in it. This is the one registered intentional difference
   * between the two surfaces (plan D12).
   */
  readonly phaseDescription: string;
  /** Null while registration identities are not yet public. */
  readonly records: SheriffCandidateRecords | null;
  /** The already-formatted speaking-order sentence, or null. */
  readonly speakingText: string | null;
  /** Submission counts for an open voting round, or null. */
  readonly voteProgress: {
    readonly submittedCount: number;
    readonly eligibleCount: number;
  } | null;
  readonly rounds: readonly SheriffElectionPresentationRoundInput[];
  /** Null while the election is not completed. */
  readonly result: SheriffElectionResult | null;
}

export type SheriffElectionPresentationRow =
  | { readonly kind: 'phase'; readonly title: string; readonly description: string }
  | {
      readonly kind: 'result';
      readonly resultKind: 'elected' | 'noSheriff';
      readonly sheriffSeat: number | null;
      /** Timeline step title: '当选警长' | '没有警长'. */
      readonly timelineTitle: string;
      /** Panel banner title: 'X号 · 当选警长' | the no-sheriff reason. */
      readonly bannerTitle: string;
      /** Panel banner subtitle, the elected line, or null. */
      readonly bannerSubtitle: string | null;
      /** The no-sheriff reason text, or null when elected. */
      readonly noSheriffText: string | null;
    }
  | {
      readonly kind: 'registration';
      readonly seats: readonly {
        readonly seat: number;
        readonly isWithdrawn: boolean;
      }[];
      /** 'X号已退水、Y号已退水', or null when nobody withdrew. */
      readonly withdrawnNote: string | null;
    }
  | {
      readonly kind: 'candidates';
      readonly label: '候选' | '平票候选';
      readonly seats: readonly number[];
    }
  | { readonly kind: 'speaking'; readonly text: string }
  | {
      readonly kind: 'voteProgress';
      readonly submittedCount: number;
      readonly eligibleCount: number;
      /** The one formatted progress line: 'x/y 已提交'. */
      readonly text: string;
    }
  | {
      readonly kind: 'round';
      readonly key: SheriffRoundRecord['round'];
      readonly title: string;
      readonly candidates: readonly {
        readonly seat: number;
        readonly votes: number;
        readonly voterSeats: readonly number[];
        readonly isWinner: boolean;
      }[];
      readonly abstainingSeats: readonly number[];
      /** True when no ballot was cast and nobody abstained. */
      readonly isEmpty: boolean;
    };

export interface SheriffElectionPresentation {
  readonly rows: readonly SheriffElectionPresentationRow[];
}

/**
 * Moved verbatim from `SheriffElectionReadOnly` (the baseline): two seat
 * lists are the same only when they match seat for seat, in order.
 * Do not silently replace this with a set comparison.
 */
function areSameSeats(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length && first.every((seat, index) => seat === second[index]);
}

export function createSheriffElectionPresentation(
  input: SheriffElectionPresentationInput,
): SheriffElectionPresentation {
  const phaseRow: SheriffElectionPresentationRow = {
    kind: 'phase',
    title: SHERIFF_ELECTION_PHASE_CONTENT[input.phase].title,
    description: input.phaseDescription,
  };

  // Registration secrecy: a registration phase, or null records, exposes
  // only the phase status — no seats, no counts, no rounds, no result.
  // Anything else arriving with a registration is a corrupt input.
  if (input.phase === 'registration' || input.records === null) {
    if (input.rounds.length > 0 || input.result !== null) {
      throw new Error(
        '[FAIL-FAST] Sheriff election presentation received rounds or a result with no public records',
      );
    }
    return { rows: [phaseRow] };
  }

  const { records } = input;
  const rows: SheriffElectionPresentationRow[] = [phaseRow];

  if (input.result !== null) {
    const decidingRoundKey = input.rounds[input.rounds.length - 1]?.key;
    rows.push(
      input.result.kind === 'elected'
        ? {
            kind: 'result',
            resultKind: 'elected',
            sheriffSeat: input.result.sheriffSeat,
            timelineTitle: '当选警长',
            bannerTitle: `${formatSeat(input.result.sheriffSeat)} · 当选警长`,
            bannerSubtitle: formatSheriffElectedLine(input.result.sheriffSeat, decidingRoundKey),
            noSheriffText: null,
          }
        : {
            kind: 'result',
            resultKind: 'noSheriff',
            sheriffSeat: null,
            timelineTitle: '没有警长',
            bannerTitle: getNoSheriffText(input.result),
            bannerSubtitle: null,
            noSheriffText: getNoSheriffText(input.result),
          },
    );
  }

  rows.push({
    kind: 'registration',
    seats: records.registeredSeats.map((seat) => ({
      seat,
      isWithdrawn: records.withdrawnSeats.includes(seat),
    })),
    withdrawnNote:
      records.withdrawnSeats.length === 0
        ? null
        : records.withdrawnSeats.map((seat) => `${formatSeat(seat)}已退水`).join('、'),
  });

  if (!areSameSeats(records.registeredSeats, records.activeCandidateSeats)) {
    rows.push({
      kind: 'candidates',
      label: input.phase === 'runoffSpeech' || input.phase === 'runoffVote' ? '平票候选' : '候选',
      seats: records.activeCandidateSeats,
    });
  }

  if (input.speakingText !== null) {
    rows.push({ kind: 'speaking', text: input.speakingText });
  }

  if (input.voteProgress !== null) {
    rows.push({
      kind: 'voteProgress',
      submittedCount: input.voteProgress.submittedCount,
      eligibleCount: input.voteProgress.eligibleCount,
      text: `${input.voteProgress.submittedCount}/${input.voteProgress.eligibleCount} 已提交`,
    });
  }

  // The deciding round is the last closed round; only its winner is
  // marked, and only when the election elected a sheriff.
  const decidingRoundKey = input.rounds[input.rounds.length - 1]?.key;
  for (const round of input.rounds) {
    const totalVotes = round.perCandidate.reduce((sum, candidate) => sum + candidate.votes, 0);
    rows.push({
      kind: 'round',
      key: round.key,
      title: getSheriffElectionRoundTitle(round.key),
      candidates: round.perCandidate.map((candidate) => ({
        seat: candidate.seat,
        votes: candidate.votes,
        voterSeats: candidate.voterSeats,
        isWinner:
          input.result?.kind === 'elected' &&
          round.key === decidingRoundKey &&
          candidate.seat === input.result.sheriffSeat,
      })),
      abstainingSeats: round.abstainingSeats,
      isEmpty: totalVotes + round.abstainingSeats.length === 0,
    });
  }

  return { rows };
}

export function createSheriffElectionPresentationFromView(
  view: Pick<
    SheriffElectionViewModel,
    | 'phase'
    | 'phaseDescription'
    | 'candidateRecords'
    | 'speakingInstruction'
    | 'voteProgress'
    | 'completedRounds'
    | 'finalResult'
  >,
): SheriffElectionPresentation {
  return createSheriffElectionPresentation({
    phase: view.phase,
    phaseDescription: view.phaseDescription,
    records: view.candidateRecords,
    speakingText: view.speakingInstruction,
    voteProgress: view.voteProgress,
    rounds: view.completedRounds.map((round) => ({
      key: round.key,
      perCandidate: round.perCandidate,
      abstainingSeats: round.abstainingSeats,
    })),
    result: view.finalResult,
  });
}

export function createSheriffElectionPresentationFromSection(
  section: NightReviewSheriffSection,
): SheriffElectionPresentation {
  switch (section.kind) {
    case 'registration':
      return createSheriffElectionPresentation({
        phase: 'registration',
        phaseDescription: SHERIFF_ELECTION_PHASE_CONTENT.registration.description,
        records: null,
        speakingText: null,
        voteProgress: null,
        rounds: [],
        result: null,
      });
    case 'inProgress':
      return createSheriffElectionPresentation({
        phase: section.phase,
        phaseDescription: SHERIFF_ELECTION_PHASE_CONTENT[section.phase].description,
        records: {
          registeredSeats: section.registeredSeats,
          withdrawnSeats: section.withdrawnSeats,
          activeCandidateSeats: section.candidateSeats,
        },
        speakingText:
          section.speakingOrder === null ? null : formatSpeakingOrder(section.speakingOrder),
        voteProgress: section.voteProgress,
        rounds: section.closedRounds.map((round) => ({
          key: round.round,
          perCandidate: round.perCandidate,
          abstainingSeats: round.abstainingSeats,
        })),
        result: null,
      });
    case 'completed':
      return createSheriffElectionPresentation({
        phase: 'completed',
        phaseDescription: SHERIFF_ELECTION_PHASE_CONTENT.completed.description,
        records: {
          registeredSeats: section.registeredSeats,
          withdrawnSeats: section.withdrawnSeats,
          activeCandidateSeats: section.activeCandidateSeats,
        },
        speakingText: null,
        voteProgress: null,
        rounds: section.rounds.map((round) => ({
          key: round.round,
          perCandidate: round.perCandidate,
          abstainingSeats: round.abstainingSeats,
        })),
        result: section.result,
      });
  }
}

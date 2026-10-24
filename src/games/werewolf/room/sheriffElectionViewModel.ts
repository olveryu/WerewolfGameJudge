/**
 * Pure sheriff-election UI projection.
 *
 * Converts the authoritative election snapshot into display text and local
 * capabilities. Open ballots expose only submission progress and the effective
 * player's own choice; closed rounds expose the full public result.
 */

import type {
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
  SheriffSpeakingDirection,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { HOST_MANAGEMENT_LABEL } from '@/features/room/model/RoomHostManagement';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

import type { SheriffCandidateRecords, SheriffRoundRecord } from './sheriffElectionRecord';
import {
  deriveSheriffRoundRecord,
  getSheriffCandidateRecords,
  getSheriffVoteProgress,
} from './sheriffElectionRecord';

export interface SheriffCandidateOptionViewModel {
  readonly seat: number;
  readonly isSelected: boolean;
}

export type SheriffBallotSelectionViewModel =
  | { readonly kind: 'notSubmitted' }
  | { readonly kind: 'abstained' }
  | { readonly kind: 'candidate'; readonly seat: number };

/**
 * One closed round as the panel renders it: the shared record's tally plus
 * the panel's round title. The tally itself lives only in
 * sheriffElectionRecord; this view model never re-derives it.
 */
export interface SheriffElectionRoundViewModel {
  readonly key: SheriffRoundRecord['round'];
  readonly title: string;
  readonly perCandidate: SheriffRoundRecord['perCandidate'];
  readonly abstainingSeats: SheriffRoundRecord['abstainingSeats'];
}

export interface SheriffElectionViewModel {
  readonly phase: SheriffElectionState['phase'];
  readonly phaseTitle: string;
  readonly phaseDescription: string;
  /** Null while registration identities are not yet public. */
  readonly candidateRecords: SheriffCandidateRecords | null;
  readonly speakingInstruction: string | null;
  readonly voteProgress: {
    readonly submittedCount: number;
    readonly eligibleCount: number;
  } | null;
  /** Null means the effective player is not eligible to vote in this phase. */
  readonly myBallot: SheriffBallotSelectionViewModel | null;
  readonly candidateOptions: readonly SheriffCandidateOptionViewModel[];
  readonly completedRounds: readonly SheriffElectionRoundViewModel[];
  readonly finalResult: SheriffElectionResult | null;
  readonly canRegister: boolean;
  readonly canCancelRegistration: boolean;
  readonly canWithdraw: boolean;
  readonly canVote: boolean;
  readonly canAdvance: boolean;
  readonly advanceLabel: string | null;
}

interface SheriffElectionViewModelInput {
  readonly gameState: LocalGameState;
  readonly effectiveSeat: number | null;
  readonly isHost: boolean;
}

type VotingElection = Extract<SheriffElectionState, { readonly phase: 'firstVote' | 'runoffVote' }>;

const SPEAKING_DIRECTION_LABELS = {
  clockwise: '顺时针',
  counterclockwise: '逆时针',
} satisfies Record<SheriffSpeakingDirection, string>;

/**
 * Panel phase copy, shared with the night report: the report renders the
 * panel's phase titles and descriptions (never the host variant — the
 * archive is read-only, host instructions do not belong in it).
 */
export const SHERIFF_ELECTION_PHASE_CONTENT: Record<
  SheriffElectionState['phase'],
  { readonly title: string; readonly description: string; readonly hostDescription?: string }
> = {
  registration: {
    title: '报名上警',
    description: '想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
    hostDescription: `报名截止后，请在「${HOST_MANAGEMENT_LABEL}」中结束报名。`,
  },
  candidateSpeech: {
    title: '竞选发言',
    description: '候选人依次发言，发言期间可退水',
  },
  withdrawal: {
    title: '退水确认',
    description: '候选人最后确认是否退水，房主随后确认候选名单',
  },
  firstVote: {
    title: '首轮投票',
    description: '未上警玩家投票，提交前后均可改票或弃票',
  },
  runoffSpeech: {
    title: '平票发言',
    description: '平票候选人依次发言，发言期间可退水',
  },
  runoffVote: {
    title: '平票投票',
    description: '除平票候选人外，其他在座玩家均可投票',
  },
  completed: {
    title: '竞选结束',
    description: '报名、退水与每轮投票结果均已公开并保留',
  },
};

function assertOccupiedSeat(gameState: LocalGameState, seat: number): void {
  const player = gameState.players.get(seat);
  if (player === undefined || player === null) {
    throw new Error(`[FAIL-FAST] Sheriff election references empty seat ${seat}`);
  }
}

function assertOccupiedSeats(gameState: LocalGameState, seats: readonly number[]): void {
  for (const seat of seats) assertOccupiedSeat(gameState, seat);
}

function getSpeakingInstruction(
  gameState: LocalGameState,
  election: SheriffElectionState,
): string | null {
  if (election.phase !== 'candidateSpeech' && election.phase !== 'runoffSpeech') return null;
  assertOccupiedSeat(gameState, election.speakingStartSeat);
  const direction = SPEAKING_DIRECTION_LABELS[election.speakingDirection];
  return `从 ${formatSeat(election.speakingStartSeat)}开始，${direction}发言`;
}

function getAdvanceLabel(election: SheriffElectionState): string | null {
  switch (election.phase) {
    case 'registration':
      return '结束报名';
    case 'candidateSpeech':
    case 'runoffSpeech':
      return '结束发言';
    case 'withdrawal':
      return '确认候选名单';
    case 'firstVote':
    case 'runoffVote':
      // Voting phases close on settle-countdown expiry; there is
      // no Host advance to label.
      return null;
    case 'completed':
      return null;
  }
}

/**
 * The panel's title for one closed round, shared with the night report:
 * both surfaces label the same record with the same title.
 */
export function getSheriffElectionRoundTitle(round: SheriffRoundRecord['round']): string {
  return round === 'first' ? '首轮投票结果' : '平票投票结果';
}

/**
 * One closed round for the panel: the shared record's tally plus the
 * panel's title. Occupied-seat assertions stay in this shell — the core
 * never sees a player roster. Coverage is preserved: every eligible voter
 * is either a voter seat or an abstaining seat in the record (the core
 * fails fast on any missing ballot), so asserting the record's seats
 * asserts every candidate, voter and abstainer the old code asserted.
 */
function createCompletedRoundViewModel(
  gameState: LocalGameState,
  round: SheriffElectionRoundResult,
): SheriffElectionRoundViewModel {
  const record = deriveSheriffRoundRecord(round);
  assertOccupiedSeats(
    gameState,
    record.perCandidate.map((candidate) => candidate.seat),
  );
  assertOccupiedSeats(
    gameState,
    record.perCandidate.flatMap((candidate) => candidate.voterSeats),
  );
  assertOccupiedSeats(gameState, record.abstainingSeats);

  return {
    key: record.round,
    title: getSheriffElectionRoundTitle(record.round),
    perCandidate: record.perCandidate,
    abstainingSeats: record.abstainingSeats,
  };
}

function getFinalResult(
  gameState: LocalGameState,
  result: SheriffElectionResult | undefined,
): SheriffElectionResult | null {
  if (result === undefined) return null;
  if (result.kind === 'elected') assertOccupiedSeat(gameState, result.sheriffSeat);
  return result;
}

function getVotingState(election: SheriffElectionState): VotingElection | null {
  return election.phase === 'firstVote' || election.phase === 'runoffVote' ? election : null;
}

/** Create the UI projection for an active or completed sheriff election. */
export function createSheriffElectionViewModel(
  input: SheriffElectionViewModelInput,
): SheriffElectionViewModel | null {
  const election = input.gameState.sheriffElection;
  if (election === undefined) return null;

  const phaseContent = SHERIFF_ELECTION_PHASE_CONTENT[election.phase];
  const candidateRecords = getSheriffCandidateRecords(election);
  const speakingInstruction = getSpeakingInstruction(input.gameState, election);
  const votingState = getVotingState(election);
  assertOccupiedSeats(input.gameState, election.registeredSeats);
  assertOccupiedSeats(input.gameState, election.withdrawnSeats);
  if (candidateRecords !== null) {
    assertOccupiedSeats(input.gameState, candidateRecords.activeCandidateSeats);
  }

  let myBallot: SheriffBallotSelectionViewModel | null = null;
  if (
    input.effectiveSeat !== null &&
    votingState !== null &&
    votingState.eligibleVoterSeats.includes(input.effectiveSeat)
  ) {
    if (!Object.hasOwn(votingState.ballots, input.effectiveSeat)) {
      myBallot = { kind: 'notSubmitted' };
    } else {
      const targetSeat = votingState.ballots[input.effectiveSeat];
      if (targetSeat === undefined) {
        throw new Error(
          `[FAIL-FAST] Sheriff election has no submitted ballot for seat ${input.effectiveSeat}`,
        );
      }
      myBallot =
        targetSeat === null ? { kind: 'abstained' } : { kind: 'candidate', seat: targetSeat };
    }
  }
  const canVote = myBallot !== null;
  const selectedCandidateSeat =
    myBallot !== null && myBallot.kind === 'candidate' ? myBallot.seat : null;
  const canWithdrawFromPhase =
    election.phase === 'candidateSpeech' ||
    election.phase === 'withdrawal' ||
    election.phase === 'runoffSpeech';
  const isActiveRunoffCandidate =
    election.phase !== 'runoffSpeech' ||
    (input.effectiveSeat !== null && election.candidateSeats.includes(input.effectiveSeat));
  const canWithdraw =
    input.effectiveSeat !== null &&
    canWithdrawFromPhase &&
    isActiveRunoffCandidate &&
    election.registeredSeats.includes(input.effectiveSeat) &&
    !election.withdrawnSeats.includes(input.effectiveSeat);

  return {
    phase: election.phase,
    phaseTitle: phaseContent.title,
    phaseDescription:
      input.isHost && phaseContent.hostDescription !== undefined
        ? phaseContent.hostDescription
        : phaseContent.description,
    candidateRecords,
    speakingInstruction,
    voteProgress: getSheriffVoteProgress(election),
    myBallot,
    candidateOptions:
      canVote && votingState !== null
        ? votingState.candidateSeats.map((seat) => ({
            seat,
            isSelected: selectedCandidateSeat === seat,
          }))
        : [],
    completedRounds: election.completedRounds.map((round) =>
      createCompletedRoundViewModel(input.gameState, round),
    ),
    finalResult: getFinalResult(input.gameState, input.gameState.sheriffElectionResult),
    canRegister:
      election.phase === 'registration' &&
      input.effectiveSeat !== null &&
      !election.registeredSeats.includes(input.effectiveSeat),
    canCancelRegistration:
      election.phase === 'registration' &&
      input.effectiveSeat !== null &&
      election.registeredSeats.includes(input.effectiveSeat),
    canWithdraw,
    canVote,
    canAdvance:
      input.isHost &&
      election.phase !== 'completed' &&
      election.phase !== 'firstVote' &&
      election.phase !== 'runoffVote',
    advanceLabel: getAdvanceLabel(election),
  };
}

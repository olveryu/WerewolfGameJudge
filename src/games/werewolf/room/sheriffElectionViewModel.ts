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
} from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

export interface SheriffCandidateOptionViewModel {
  readonly seat: number;
  readonly isSelected: boolean;
}

export type SheriffBallotSelectionViewModel =
  | { readonly kind: 'notSubmitted' }
  | { readonly kind: 'abstained' }
  | { readonly kind: 'candidate'; readonly seat: number };

export interface SheriffElectionRoundViewModel {
  readonly key: SheriffElectionRoundResult['round'];
  readonly title: string;
  readonly candidateSeats: readonly number[];
  readonly eligibleVoterSeats: readonly number[];
  readonly voteCounts: Readonly<Record<number, number>>;
  readonly ballots: Readonly<Record<number, number | null>>;
}

export interface SheriffCandidateRecordsViewModel {
  readonly registeredSeats: readonly number[];
  readonly withdrawnSeats: readonly number[];
  readonly activeCandidateSeats: readonly number[];
}

export interface SheriffElectionViewModel {
  readonly phase: SheriffElectionState['phase'];
  readonly phaseTitle: string;
  readonly phaseDescription: string;
  /** Null while registration identities are not yet public. */
  readonly candidateRecords: SheriffCandidateRecordsViewModel | null;
  readonly speakingOrder: readonly number[];
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

const PHASE_CONTENT: Record<
  SheriffElectionState['phase'],
  { readonly title: string; readonly description: string }
> = {
  registration: {
    title: '报名上警',
    description: '玩家可报名，房主结束报名后随机确定发言顺序',
  },
  candidateSpeech: {
    title: '竞选发言',
    description: '候选人按下方顺序依次发言，发言期间可退水',
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
    description: '平票候选人按下方顺序依次发言，发言期间可退水',
  },
  runoffVote: {
    title: '平票投票',
    description: '除平票候选人外，其他在座玩家均可投票',
  },
  completed: {
    title: '竞选结束',
    description: '报名、退水与每轮投票结果已公开保留',
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

function createCandidateRecords(
  election: SheriffElectionState,
  activeCandidateSeats: readonly number[],
): SheriffCandidateRecordsViewModel | null {
  if (election.phase === 'registration') return null;
  return {
    registeredSeats: election.registeredSeats,
    withdrawnSeats: election.withdrawnSeats,
    activeCandidateSeats,
  };
}

function getSpeakingOrder(election: SheriffElectionState): readonly number[] {
  return election.phase === 'candidateSpeech' || election.phase === 'runoffSpeech'
    ? election.speakingOrder
    : [];
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
      return '公布首轮结果';
    case 'runoffVote':
      return '公布最终结果';
    case 'completed':
      return null;
  }
}

function createCompletedRoundViewModel(
  gameState: LocalGameState,
  round: SheriffElectionRoundResult,
): SheriffElectionRoundViewModel {
  assertOccupiedSeats(gameState, round.candidateSeats);
  assertOccupiedSeats(gameState, round.eligibleVoterSeats);
  for (const candidateSeat of round.candidateSeats) {
    if (round.voteCounts[candidateSeat] === undefined) {
      throw new Error(`[FAIL-FAST] Closed sheriff round has no count for seat ${candidateSeat}`);
    }
  }
  for (const voterSeat of round.eligibleVoterSeats) {
    const targetSeat = round.ballots[voterSeat];
    if (targetSeat === undefined) {
      throw new Error(`[FAIL-FAST] Closed sheriff round has no ballot for seat ${voterSeat}`);
    }
    if (targetSeat !== null) assertOccupiedSeat(gameState, targetSeat);
  }

  return {
    key: round.round,
    title: round.round === 'first' ? '首轮投票结果' : '平票投票结果',
    candidateSeats: round.candidateSeats,
    eligibleVoterSeats: round.eligibleVoterSeats,
    voteCounts: round.voteCounts,
    ballots: round.ballots,
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

  const phaseContent = PHASE_CONTENT[election.phase];
  const activeCandidateSeats = getActiveCandidateSeats(election);
  const candidateRecords = createCandidateRecords(election, activeCandidateSeats);
  const speakingOrder = getSpeakingOrder(election);
  const votingState = getVotingState(election);
  assertOccupiedSeats(input.gameState, election.registeredSeats);
  assertOccupiedSeats(input.gameState, election.withdrawnSeats);
  assertOccupiedSeats(input.gameState, activeCandidateSeats);
  assertOccupiedSeats(input.gameState, speakingOrder);

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
    phaseDescription: phaseContent.description,
    candidateRecords,
    speakingOrder,
    voteProgress:
      votingState === null
        ? null
        : {
            submittedCount: Object.keys(votingState.ballots).length,
            eligibleCount: votingState.eligibleVoterSeats.length,
          },
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
    canAdvance: input.isHost && election.phase !== 'completed',
    advanceLabel: getAdvanceLabel(election),
  };
}

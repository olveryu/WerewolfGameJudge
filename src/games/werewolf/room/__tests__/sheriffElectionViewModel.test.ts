/** Tests for the privacy-preserving sheriff-election UI projection. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { createSheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

const PLAYERS: GameState['players'] = {
  0: { userId: 'host-1', seat: 0, role: 'wolf', hasViewedRole: true },
  1: { userId: 'user-1', seat: 1, role: 'seer', hasViewedRole: true },
  2: { userId: 'user-2', seat: 2, role: 'hunter', hasViewedRole: true },
  3: { userId: 'user-3', seat: 3, role: 'villager', hasViewedRole: true },
};

const ROSTER: NonNullable<GameState['roster']> = {
  'host-1': { displayName: 'Alice' },
  'user-1': { displayName: 'Bob' },
  'user-2': { displayName: 'Chen' },
  'user-3': { displayName: 'Dana' },
};

function createLocalState(overrides: Partial<GameState>) {
  return toWerewolfLocalState(
    buildWerewolfTestState({
      status: GameStatus.Day,
      templateRoles: ['wolf', 'seer', 'hunter', 'villager'],
      players: PLAYERS,
      roster: ROSTER,
      rules: { isSheriffElectionEnabled: true },
      ...overrides,
    }),
  );
}

describe('createSheriffElectionViewModel', () => {
  it('hides candidate records during registration while deriving personal actions', () => {
    const gameState = createLocalState({
      sheriffElection: {
        phase: 'registration',
        registeredSeats: [1, 0],
        withdrawnSeats: [],
        completedRounds: [],
      },
    });

    const viewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 0,
      isHost: false,
    });

    expect(viewModel).toMatchObject({
      phaseTitle: '报名上警',
      candidateRecords: null,
      canRegister: false,
      canCancelRegistration: true,
      canWithdraw: false,
      canAdvance: false,
    });

    const unregisteredViewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 2,
      isHost: false,
    });
    expect(unregisteredViewModel).toMatchObject({
      canRegister: true,
      canCancelRegistration: false,
      canWithdraw: false,
    });
  });

  it('publishes ordered candidate records after registration closes', () => {
    const gameState = createLocalState({
      sheriffElection: {
        phase: 'candidateSpeech',
        registeredSeats: [1, 0],
        withdrawnSeats: [],
        completedRounds: [],
        speakingStartSeat: 0,
        speakingDirection: 'clockwise',
      },
    });

    const viewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 2,
      isHost: false,
    });

    expect(viewModel?.candidateRecords).toEqual({
      registeredSeats: [1, 0],
      withdrawnSeats: [],
      activeCandidateSeats: [1, 0],
    });
    expect(viewModel?.speakingInstruction).toBe('从 1号开始，顺时针发言');
  });

  it('hides open ballot directions while showing progress and the effective player own ballot', () => {
    const gameState = createLocalState({
      sheriffElection: {
        phase: 'firstVote',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2, 3],
        ballots: { 2: 0, 3: 1 },
      },
    });

    const viewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 2,
      isHost: false,
    });

    expect(viewModel).toMatchObject({
      voteProgress: { submittedCount: 2, eligibleCount: 2 },
      myBallot: { kind: 'candidate', seat: 0 },
      canVote: true,
      completedRounds: [],
    });
    expect(viewModel?.candidateOptions).toEqual([
      { seat: 0, isSelected: true },
      { seat: 1, isSelected: false },
    ]);
    expect(JSON.stringify(viewModel)).not.toMatch(/Alice|Bob|Chen|Dana/);
  });

  it('publishes every ballot and tally only after a round closes', () => {
    const gameState = createLocalState({
      status: GameStatus.Ended,
      sheriffElection: {
        phase: 'completed',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [
          {
            round: 'first',
            candidateSeats: [0, 1],
            eligibleVoterSeats: [2, 3],
            ballots: { 2: 0, 3: null },
            voteCounts: { 0: 1, 1: 0 },
            abstainingSeats: [3],
          },
        ],
      },
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
    });

    const viewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 2,
      isHost: false,
    });

    expect(viewModel?.completedRounds).toEqual([
      {
        key: 'first',
        title: '首轮投票结果',
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2, 3],
        voteCounts: { 0: 1, 1: 0 },
        ballots: { 2: 0, 3: null },
      },
    ]);
    expect(viewModel?.finalResult).toEqual({ kind: 'elected', sheriffSeat: 0 });
    expect(JSON.stringify(viewModel)).not.toMatch(/Alice|Bob|Chen|Dana/);
  });

  it('allows only tied candidates to withdraw during runoff speech', () => {
    const gameState = createLocalState({
      sheriffElection: {
        phase: 'runoffSpeech',
        registeredSeats: [0, 1, 2],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 2],
        speakingStartSeat: 2,
        speakingDirection: 'counterclockwise',
      },
    });

    const losingCandidate = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 1,
      isHost: false,
    });
    const tiedCandidate = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 2,
      isHost: true,
    });

    expect(losingCandidate?.canWithdraw).toBe(false);
    expect(tiedCandidate).toMatchObject({
      phaseDescription: '平票候选人依次发言，发言期间可退水',
      speakingInstruction: '从 3号开始，逆时针发言',
      canWithdraw: true,
      canAdvance: true,
      advanceLabel: '结束发言',
    });
  });

  it('removes withdrawn tied candidates from the active runoff list', () => {
    const gameState = createLocalState({
      sheriffElection: {
        phase: 'runoffSpeech',
        registeredSeats: [0, 1, 2],
        withdrawnSeats: [2],
        completedRounds: [],
        candidateSeats: [0, 2],
        speakingStartSeat: 0,
        speakingDirection: 'clockwise',
      },
    });

    const viewModel = createSheriffElectionViewModel({
      gameState,
      effectiveSeat: 3,
      isHost: false,
    });

    expect(viewModel?.candidateRecords?.activeCandidateSeats).toEqual([0]);
    expect(viewModel?.speakingInstruction).toBe('从 1号开始，顺时针发言');
  });
});

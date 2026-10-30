/** Unit tests for the sheriff-election HUD summary copy. */

import { getHudSummary } from '@/games/werewolf/room/components/SheriffElectionHud';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';

const BASE_VIEW: SheriffElectionViewModel = {
  phase: 'firstVote',
  phaseTitle: '首轮投票',
  phaseDescription: '投票',
  candidateRecords: null,
  speakingInstruction: null,
  voteProgress: null,
  myBallot: null,
  candidateOptions: [],
  completedRounds: [],
  finalResult: null,
  canRegister: false,
  canCancelRegistration: false,
  canWithdraw: false,
  canVote: false,
  canAdvance: false,
  advanceLabel: null,
};

function createModel(viewOverrides: Partial<SheriffElectionViewModel>): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...viewOverrides },
    pendingAction: null,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
    requestAdvance: jest.fn(),
    requestEndBySelfDestruct: jest.fn(),
  };
}

describe('getHudSummary', () => {
  it('announces the automatic publication once all votes are in, for host and players alike', () => {
    const hostModel = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4 },
    });
    expect(getHudSummary(hostModel)).toBe('4/4 人已投票，即将自动公布结果');
    const playerModel = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4 },
      canVote: true,
      myBallot: { kind: 'candidate', seat: 1 },
    });
    expect(getHudSummary(playerModel)).toBe('4/4 人已投票，即将自动公布结果');
  });

  it('tells a player who has not voted where to vote', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4 },
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
    });
    expect(getHudSummary(model)).toBe('2/4 人已投票，点击下方「选择投票」投票');
  });
});

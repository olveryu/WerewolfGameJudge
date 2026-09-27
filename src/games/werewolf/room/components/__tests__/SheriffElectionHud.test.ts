/** Unit tests for the sheriff-election HUD summary copy. */

import { getHudSummary } from '@/games/werewolf/room/components/SheriffElectionHud';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { HOST_MANAGEMENT_LABEL } from '@/features/room/model/RoomHostManagement';

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
    requestEndBySelfDestruct: jest.fn(),
  };
}

describe('getHudSummary', () => {
  it('tells the host where to announce once all votes are in', () => {
    const model = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4 },
      canAdvance: true,
      advanceLabel: '公布首轮结果',
    });
    expect(getHudSummary(model)).toBe(`4/4 人已投票，请在「${HOST_MANAGEMENT_LABEL}」公布`);
  });

  it('tells non-hosts to wait for the host once all votes are in', () => {
    const model = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4 },
      canAdvance: false,
    });
    expect(getHudSummary(model)).toBe('4/4 人已投票，等待房主公布结果');
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

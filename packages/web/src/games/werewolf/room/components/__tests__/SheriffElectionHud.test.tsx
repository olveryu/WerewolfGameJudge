/** Unit tests for the sheriff-election HUD summary copy. */

import { render, screen } from '@testing-library/react';

import {
  getHudSummary,
  SheriffElectionHud,
} from '@/games/werewolf/room/components/SheriffElectionHud';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';

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

function createModel(
  viewOverrides: Partial<SheriffElectionViewModel>,
  remainingSeconds: number | null = null,
): SheriffElectionPanelModel {
  return {
    view: { ...BASE_VIEW, ...viewOverrides },
    remainingSeconds,
    pendingAction: null,
    register: vi.fn(async () => undefined),
    cancelRegistration: vi.fn(async () => undefined),
    withdraw: vi.fn(async () => undefined),
    vote: vi.fn(async () => undefined),
    advance: vi.fn(async () => undefined),
    requestAdvance: vi.fn(),
    requestEndBySelfDestruct: vi.fn(),
  };
}

describe('getHudSummary', () => {
  it('announces the automatic publication once all votes are in, for host and players alike', () => {
    const hostModel = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      5,
    );
    expect(getHudSummary(hostModel)).toBe('4/4 人已投票，5秒后自动公布结果');
    const playerModel = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
        canVote: true,
        myBallot: { kind: 'candidate', seat: 1 },
      },
      3,
    );
    expect(getHudSummary(playerModel)).toBe('4/4 人已投票，3秒后自动公布结果');
  });

  it('falls back to the static sentence when the deadline has not armed yet', () => {
    const model = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
    });
    expect(getHudSummary(model)).toBe('4/4 人已投票，即将自动公布结果');
  });

  it('falls back to the static sentence once the deadline is reached', () => {
    const model = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      0,
    );
    expect(getHudSummary(model)).toBe('4/4 人已投票，即将自动公布结果');
  });

  it('tells a player who has not voted where to vote', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4, pendingSeats: [1, 3] },
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
    });
    expect(getHudSummary(model)).toBe('2/4 人已投票，点击下方「选择投票」投票');
  });
});

describe('SheriffElectionHud pending row', () => {
  it('shows the pending seats on the HUD while voting is incomplete', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4, pendingSeats: [1, 3] },
    });
    render(<SheriffElectionHud model={model} onOpenDetails={null} />);

    expect(screen.getByTestId(TESTIDS.sheriffHudPendingSeats)).toBeInTheDocument();
    expect(screen.getByTestId('sheriff-hud-pending-seats-seat-1')).toBeInTheDocument();
    expect(screen.getByTestId('sheriff-hud-pending-seats-seat-3')).toBeInTheDocument();
    expect(screen.queryByTestId('sheriff-hud-pending-seats-seat-0')).toBeNull();
  });

  it('hides the pending row once every vote is in', () => {
    const model = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      5,
    );
    render(<SheriffElectionHud model={model} onOpenDetails={null} />);

    expect(screen.queryByTestId(TESTIDS.sheriffHudPendingSeats)).toBeNull();
  });
});

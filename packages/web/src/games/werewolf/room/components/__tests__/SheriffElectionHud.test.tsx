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
    expect(getHudSummary(hostModel)).toBe('已全部投票，5 秒后揭晓');
    const playerModel = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
        canVote: true,
        myBallot: { kind: 'candidate', seat: 1 },
      },
      3,
    );
    expect(getHudSummary(playerModel)).toBe('已全部投票，3 秒后揭晓');
  });

  it('falls back to the static sentence when the deadline has not armed yet', () => {
    const model = createModel({
      voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
    });
    expect(getHudSummary(model)).toBe('已全部投票，等待揭晓');
  });

  it('falls back to the static sentence once the deadline is reached', () => {
    const model = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      0,
    );
    expect(getHudSummary(model)).toBe('已全部投票，等待揭晓');
  });

  it('uses the shared voting label while votes are pending', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4, pendingSeats: [1, 3] },
      canVote: true,
      myBallot: { kind: 'notSubmitted' },
    });

    expect(getHudSummary(model)).toBe('投票中');
  });

  it('tailors registration guidance to the viewer', () => {
    const model = createModel({ phase: 'registration', canRegister: true });
    expect(getHudSummary(model, false)).toBe('可在底部报名上警');
    expect(getHudSummary(model, true)).toBe('请在主持管理中结束报名');
    expect(getHudSummary(createModel({ phase: 'registration' }), false)).toBe('等待房主结束报名');
  });
});

describe('SheriffElectionHud pending row', () => {
  it('keeps the summary read-only when details are elsewhere', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4, pendingSeats: [1, 3] },
    });
    render(<SheriffElectionHud model={model} isHost={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.sheriffDetailsButton)).not.toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionHudPhase)).toHaveTextContent('首轮投票');
    expect(screen.getByTestId(TESTIDS.sheriffHudPendingSeats)).toHaveTextContent('未投票：2号 4号');
    expect(screen.getByText('已投 2/4')).toBeInTheDocument();
  });

  it('hides the pending row once every vote is in', () => {
    const model = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      5,
    );
    render(<SheriffElectionHud model={model} isHost={false} />);

    expect(screen.queryByTestId(TESTIDS.sheriffHudPendingSeats)).toBeNull();
    expect(screen.getByText('已全部投票，5 秒后揭晓')).toBeInTheDocument();
  });
});

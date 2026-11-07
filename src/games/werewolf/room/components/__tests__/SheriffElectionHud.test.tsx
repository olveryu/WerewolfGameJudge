/** Unit tests for the sheriff-election HUD summary copy. */

import { render } from '@testing-library/react-native';

import {
  getHudSummary,
  SheriffElectionHud,
} from '@/games/werewolf/room/components/SheriffElectionHud';
import { createSheriffElectionPanelStyles } from '@/games/werewolf/room/components/sheriffElectionPanel.styles';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

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
  const styles = createSheriffElectionPanelStyles(colors);

  it('shows the pending seats on the HUD while voting is incomplete', () => {
    const model = createModel({
      voteProgress: { submittedCount: 2, eligibleCount: 4, pendingSeats: [1, 3] },
    });
    const screen = render(
      <SheriffElectionHud model={model} styles={styles} onOpenDetails={null} />,
    );

    const pendingRow = screen.getByTestId(TESTIDS.sheriffHudPendingSeats);
    expect(pendingRow).toBeTruthy();
    expect(screen.getByTestId('sheriff-hud-pending-seats-seat-1')).toBeTruthy();
    expect(screen.getByTestId('sheriff-hud-pending-seats-seat-3')).toBeTruthy();
    expect(screen.queryByTestId('sheriff-hud-pending-seats-seat-0')).toBeNull();
  });

  it('hides the pending row once every vote is in', () => {
    const model = createModel(
      {
        voteProgress: { submittedCount: 4, eligibleCount: 4, pendingSeats: [] },
      },
      5,
    );
    const screen = render(
      <SheriffElectionHud model={model} styles={styles} onOpenDetails={null} />,
    );

    expect(screen.queryByTestId(TESTIDS.sheriffHudPendingSeats)).toBeNull();
  });
});

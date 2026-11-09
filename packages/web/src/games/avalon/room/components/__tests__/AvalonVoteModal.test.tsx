/** 投票弹窗：队伍名单 + 赞成/反对大卡片 + 已投提示 + 揭晓倒计时 + 提交中禁用。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { AvalonVoteModal } from '../AvalonVoteModal';

function voteViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'vote',
    mySeat: 0,
    myRole: 'loyalServant',
    seats: [0, 1, 2].map((seat) => ({
      seat,
      displayName: `玩家${seat + 1}`,
      isBot: false,
      isLeader: seat === 0,
      role: null,
    })),
    leaderSeat: 0,
    nightStep: null,
    evilPeers: null,
    merlinSees: null,
    percivalSees: null,
    nightConfirmed: false,
    hasViewedRole: true,
    unviewedRoleSeats: [],
    requiredSize: 2,
    preselectedSeats: null,
    proposedSeats: [0, 1],
    teamSeats: null,
    myBallot: null,
    pendingVoteSeats: null,
    pendingPlaySeats: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: [],
    questHistory: [],
    roundHistory: [],
    lady: null,
    ladyCheckResult: null,
    ladyHistory: [],
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: null,
    winner: null,
    endReason: null,
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'public',
    playerCount: 5,
    lastVoteResult: null,
    ...overrides,
  };
}

function renderModal(
  overrides: Partial<AvalonViewModel> = {},
  remainingSeconds: number | null = null,
  isSubmitting = false,
  isOverdue = false,
  isHost = false,
) {
  const onVote = vi.fn();
  const onRetry = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <AvalonVoteModal
      viewModel={voteViewModel(overrides)}
      remainingSeconds={remainingSeconds}
      isOverdue={isOverdue}
      isHost={isHost}
      isSubmitting={isSubmitting}
      onVote={onVote}
      onRetry={onRetry}
      onClose={onClose}
    />,
  );
  return { ...utils, onVote, onRetry, onClose };
}

describe('AvalonVoteModal', () => {
  it('lists the proposed team and both ballot cards', () => {
    const { getByTestId, getByText } = renderModal();
    expect(getByText('1 号 · 玩家1')).toBeTruthy();
    expect(getByText('2 号 · 玩家2')).toBeTruthy();
    expect(getByTestId('avalon-vote-approve')).toBeTruthy();
    expect(getByTestId('avalon-vote-reject')).toBeTruthy();
  });

  it('reports the chosen ballot', () => {
    const { getByTestId, onVote } = renderModal();
    fireEvent.click(getByTestId('avalon-vote-reject'));
    expect(onVote).toHaveBeenCalledWith('reject');
  });

  it('shows the reveal countdown once every ballot is in', () => {
    const { getByTestId } = renderModal({}, 4);
    expect(getByTestId('avalon-vote-countdown')).toHaveTextContent('已全部投票，4 秒后揭晓');
  });

  it('hides the reveal countdown once the deadline is reached', () => {
    const { queryByTestId } = renderModal({ pendingVoteSeats: [] }, 0);
    expect(queryByTestId('avalon-vote-countdown')).toBeNull();
  });

  it('shows the pending seats while voting is incomplete', () => {
    const { getByTestId, queryByTestId } = renderModal({ pendingVoteSeats: [1, 3] });
    const pendingRow = getByTestId('avalon-vote-pending-seats');
    expect(pendingRow).toBeTruthy();
    expect(getByTestId('avalon-vote-pending-seats-seat-1')).toBeTruthy();
    expect(getByTestId('avalon-vote-pending-seats-seat-3')).toBeTruthy();
    expect(queryByTestId('avalon-vote-pending-seats-seat-0')).toBeNull();
  });

  it('hides the pending row once every ballot is in', () => {
    const { queryByTestId } = renderModal({ pendingVoteSeats: [] }, 4);
    expect(queryByTestId('avalon-vote-pending-seats')).toBeNull();
  });

  it('shows the settle rescue to the host once overdue', () => {
    const { getByTestId, onRetry } = renderModal({}, 0, false, true, true);
    fireEvent.click(getByTestId(TESTIDS.stageSettleRescueRetryButton));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the waiting hint and no retry button to non-hosts once overdue', () => {
    const { getByTestId, queryByTestId } = renderModal({}, 0, false, true, false);
    expect(getByTestId(TESTIDS.stageSettleRescue)).toHaveTextContent(/等待房主处理/);
    expect(queryByTestId(TESTIDS.stageSettleRescueRetryButton)).toBeNull();
  });

  it('shows my current ballot and allows changing it', () => {
    const { getByText, getByTestId, onVote } = renderModal({ myBallot: 'approve' });
    expect(getByText(/已投票（赞成）/)).toBeTruthy();
    fireEvent.click(getByTestId('avalon-vote-reject'));
    expect(onVote).toHaveBeenCalledWith('reject');
  });

  it('disables the cards while a submission is in flight', () => {
    const { getByTestId } = renderModal({}, null, true);
    expect(getByTestId('avalon-vote-approve')).toBeDisabled();
  });
});

/** 出牌弹窗：好人只有成功卡、坏人两张卡 + 已出牌提示 + 揭晓倒计时 + 提交中禁用。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react';

import { TESTIDS } from '@/testids';

import { AvalonQuestModal } from '../AvalonQuestModal';

function questViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'quest',
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
    requiredSize: null,
    preselectedSeats: null,
    proposedSeats: null,
    teamSeats: [0, 1],
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
  const onPlay = vi.fn();
  const onRetry = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <AvalonQuestModal
      viewModel={questViewModel(overrides)}
      remainingSeconds={remainingSeconds}
      isOverdue={isOverdue}
      isHost={isHost}
      isSubmitting={isSubmitting}
      onPlay={onPlay}
      onRetry={onRetry}
      onClose={onClose}
    />,
  );
  return { ...utils, onPlay, onRetry, onClose };
}

describe('AvalonQuestModal', () => {
  it('offers only the success card to good players', () => {
    const { getByTestId, queryByTestId } = renderModal();
    expect(getByTestId('avalon-quest-success')).toBeTruthy();
    expect(queryByTestId('avalon-quest-fail')).toBeNull();
  });

  it('offers both cards to evil players and reports the play', () => {
    const { getByTestId, onPlay } = renderModal({ myRole: 'minion' });
    fireEvent.click(getByTestId('avalon-quest-fail'));
    expect(onPlay).toHaveBeenCalledWith('fail');
  });

  it('shows the reveal countdown once every play is in', () => {
    const { getByTestId } = renderModal({}, 3);
    expect(getByTestId('avalon-quest-countdown')).toHaveTextContent('已全部出牌，3 秒后揭晓');
  });

  it('hides the reveal countdown once the deadline is reached', () => {
    const { queryByTestId } = renderModal({ pendingPlaySeats: [] }, 0);
    expect(queryByTestId('avalon-quest-countdown')).toBeNull();
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

  it('shows my current play without revealing anyone else', () => {
    const { getByText } = renderModal({ myPlay: 'success' });
    expect(getByText(/已出牌（成功）/)).toBeTruthy();
  });

  it('says the played card stays secret, not the player', () => {
    const { getByText, queryByText, unmount } = renderModal({ myPlay: 'success' });
    expect(getByText(/出了什么牌不公开/)).toBeTruthy();
    expect(queryByText(/出牌人不公开/)).toBeNull();
    // The dialog portals into document.body, so the first mount must go before the second.
    unmount();
    const { getByText: getByTextBefore } = renderModal();
    expect(getByTextBefore(/出了什么牌不公开/)).toBeTruthy();
  });

  it('shows the pending seats while the quest is open', () => {
    const { getByTestId, queryByTestId } = renderModal({ pendingPlaySeats: [1] });
    expect(getByTestId('avalon-quest-pending-seats-seat-1')).toBeTruthy();
    expect(queryByTestId('avalon-quest-pending-seats-seat-0')).toBeNull();
  });

  it('hides the pending row once every play is in', () => {
    const { queryByTestId } = renderModal({ pendingPlaySeats: [] }, 3);
    expect(queryByTestId('avalon-quest-pending-seats')).toBeNull();
  });

  it('disables the cards while a submission is in flight', () => {
    const { getByTestId } = renderModal({ myRole: 'minion' }, null, true);
    expect(getByTestId('avalon-quest-fail')).toBeDisabled();
  });
});

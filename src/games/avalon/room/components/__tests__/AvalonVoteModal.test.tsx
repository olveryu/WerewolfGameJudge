/** 投票弹窗：队伍名单 + 赞成/反对大卡片 + 已投提示 + 揭晓倒计时 + 提交中禁用。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

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
    proposedSeats: [0, 1],
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: [],
    questHistory: [],
    lady: null,
    ladyCheckResult: null,
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: null,
    winner: null,
    endReason: null,
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'public',
    lastVoteResult: null,
    ...overrides,
  };
}

function renderModal(
  overrides: Partial<AvalonViewModel> = {},
  remainingSeconds: number | null = null,
  isSubmitting = false,
) {
  const onVote = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <AvalonVoteModal
      viewModel={voteViewModel(overrides)}
      remainingSeconds={remainingSeconds}
      isSubmitting={isSubmitting}
      onVote={onVote}
      onClose={onClose}
    />,
  );
  return { ...utils, onVote, onClose };
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
    fireEvent.press(getByTestId('avalon-vote-reject'));
    expect(onVote).toHaveBeenCalledWith('reject');
  });

  it('shows the reveal countdown once every ballot is in', () => {
    const { getByTestId } = renderModal({}, 4);
    expect(getByTestId('avalon-vote-countdown')).toHaveTextContent('已全部投票，4 秒后揭晓');
  });

  it('shows my current ballot and allows changing it', () => {
    const { getByText, getByTestId, onVote } = renderModal({ myBallot: 'approve' });
    expect(getByText(/已投票（赞成）/)).toBeTruthy();
    fireEvent.press(getByTestId('avalon-vote-reject'));
    expect(onVote).toHaveBeenCalledWith('reject');
  });

  it('disables the cards while a submission is in flight', () => {
    const { getByTestId } = renderModal({}, null, true);
    const card = getByTestId('avalon-vote-approve');
    expect(card.props.accessibilityState).toMatchObject({ disabled: true });
    // The disabled prop is what suppresses presses at runtime.
    expect(card.props).toMatchObject({ disabled: true });
  });
});

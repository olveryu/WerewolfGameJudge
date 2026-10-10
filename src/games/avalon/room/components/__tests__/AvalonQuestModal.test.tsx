/** 出牌弹窗：好人只有成功卡、坏人两张卡 + 已出牌提示 + 揭晓倒计时 + 提交中禁用。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

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
    proposedSeats: null,
    teamSeats: [0, 1],
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
  const onPlay = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <AvalonQuestModal
      viewModel={questViewModel(overrides)}
      remainingSeconds={remainingSeconds}
      isSubmitting={isSubmitting}
      onPlay={onPlay}
      onClose={onClose}
    />,
  );
  return { ...utils, onPlay, onClose };
}

describe('AvalonQuestModal', () => {
  it('offers only the success card to good players', () => {
    const { getByTestId, queryByTestId } = renderModal();
    expect(getByTestId('avalon-quest-success')).toBeTruthy();
    expect(queryByTestId('avalon-quest-fail')).toBeNull();
  });

  it('offers both cards to evil players and reports the play', () => {
    const { getByTestId, onPlay } = renderModal({ myRole: 'minion' });
    fireEvent.press(getByTestId('avalon-quest-fail'));
    expect(onPlay).toHaveBeenCalledWith('fail');
  });

  it('shows the reveal countdown once every play is in', () => {
    const { getByTestId } = renderModal({}, 3);
    expect(getByTestId('avalon-quest-countdown')).toHaveTextContent('已全部出牌，3 秒后揭晓');
  });

  it('shows my current play without revealing anyone else', () => {
    const { getByText } = renderModal({ myPlay: 'success' });
    expect(getByText(/已出牌（成功）/)).toBeTruthy();
  });

  it('disables the cards while a submission is in flight', () => {
    const { getByTestId } = renderModal({ myRole: 'minion' }, null, true);
    const card = getByTestId('avalon-quest-fail');
    expect(card.props.accessibilityState).toMatchObject({ disabled: true });
    // The disabled prop is what suppresses presses at runtime.
    expect(card.props).toMatchObject({ disabled: true });
  });
});

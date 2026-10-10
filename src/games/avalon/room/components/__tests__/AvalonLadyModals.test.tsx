/** 湖仙三弹窗：查验二次确认（AlertModal）、确认展示、查验结果呈现。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonLadyAcknowledgeModal } from '../AvalonLadyAcknowledgeModal';
import { AvalonLadyCheckConfirmModal } from '../AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from '../AvalonLadyResultModal';

function ladyViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'lady',
    mySeat: 2,
    myRole: 'loyalServant',
    seats: [0, 1, 2, 3, 4].map((seat) => ({
      seat,
      displayName: `玩家${seat + 1}`,
      isBot: false,
      isLeader: false,
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
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: ['success', 'success'],
    questHistory: [],
    lady: {
      holderSeat: 1,
      examinedSeats: [1],
      targetSeat: 2,
      canCheck: false,
      needsAcknowledge: true,
    },
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

describe('AvalonLadyCheckConfirmModal', () => {
  it('renders nothing without a target', () => {
    const { queryByText } = render(
      <AvalonLadyCheckConfirmModal targetName={null} onConfirm={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryByText('湖中仙女查验')).toBeNull();
  });

  it('names the target in the confirmation and confirms through AlertModal', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <AvalonLadyCheckConfirmModal
        targetName="3 号 · 玩家3"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );
    expect(getByText(/确定查验【3 号 · 玩家3】的阵营/)).toBeTruthy();
    fireEvent.press(getByText('确认查验'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('AvalonLadyAcknowledgeModal', () => {
  it('names the holder and reports the acknowledgement', () => {
    const onAcknowledge = jest.fn();
    const { getByTestId, getByText } = render(
      <AvalonLadyAcknowledgeModal
        viewModel={ladyViewModel()}
        isSubmitting={false}
        onAcknowledge={onAcknowledge}
        onClose={jest.fn()}
      />,
    );
    expect(getByText(/2 号 · 玩家2 要查验你的阵营/)).toBeTruthy();
    fireEvent.press(getByTestId('avalon-lady-acknowledge'));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});

describe('AvalonLadyResultModal', () => {
  it('shows the checked faction and closes manually', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <AvalonLadyResultModal targetName="3 号 · 玩家3" faction="evil" onClose={onClose} />,
    );
    expect(getByTestId('avalon-lady-result-text')).toHaveTextContent('3 号 · 玩家3 是坏人。');
    fireEvent.press(getByTestId('avalon-lady-result-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

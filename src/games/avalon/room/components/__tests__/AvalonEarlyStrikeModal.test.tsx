/** 提前刺杀选人弹窗：覆盖层座位列表（不含自己），点选上报、取消关闭。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonEarlyStrikeModal } from '../AvalonEarlyStrikeModal';

function strikeViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'quest',
    mySeat: 0,
    myRole: 'assassin',
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
    teamSeats: [0, 1],
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: [],
    questHistory: [],
    lady: null,
    ladyCheckResult: null,
    isAssassin: true,
    canEarlyStrike: true,
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

describe('AvalonEarlyStrikeModal', () => {
  it('lists every seat except the assassin and reports the pick', () => {
    const onSelectSeat = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <AvalonEarlyStrikeModal
        viewModel={strikeViewModel()}
        onSelectSeat={onSelectSeat}
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId('avalon-early-strike-seat-0')).toBeNull();
    fireEvent.press(getByTestId('avalon-early-strike-seat-3'));
    expect(onSelectSeat).toHaveBeenCalledWith(3);
  });

  it('closes from the cancel button', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <AvalonEarlyStrikeModal
        viewModel={strikeViewModel()}
        onSelectSeat={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByTestId('avalon-early-strike-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

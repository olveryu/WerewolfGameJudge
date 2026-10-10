/** 提名视图：队长在座位盘选人（本视图只计数与提交，满员才可提交）；非队长等待。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonNominateView } from '../AvalonNominateView';

function nominateViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'nominate',
    mySeat: 0,
    myRole: 'loyalServant',
    seats: [0, 1, 2, 3, 4].map((seat) => ({
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
    proposedSeats: null,
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

describe('AvalonNominateView', () => {
  it('tells the leader to pick on the seat board and counts the selection', () => {
    const { getByText, getByTestId } = render(
      <AvalonNominateView
        viewModel={nominateViewModel()}
        selectedSeats={new Set([1])}
        isSubmitting={false}
        onPropose={jest.fn()}
      />,
    );
    expect(getByText(/在座位盘上选择队员/)).toBeTruthy();
    expect(getByText('已选 1 / 2')).toBeTruthy();
    expect(getByTestId('avalon-nominate-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('submits the picked seats once the team is full', () => {
    const onPropose = jest.fn();
    const { getByTestId } = render(
      <AvalonNominateView
        viewModel={nominateViewModel()}
        selectedSeats={new Set([0, 3])}
        isSubmitting={false}
        onPropose={onPropose}
      />,
    );
    fireEvent.press(getByTestId('avalon-nominate-submit'));
    expect(onPropose).toHaveBeenCalledWith([0, 3]);
  });

  it('shows the waiting card to non-leaders', () => {
    const { getByText, queryByTestId } = render(
      <AvalonNominateView
        viewModel={nominateViewModel({ mySeat: 2 })}
        selectedSeats={new Set()}
        isSubmitting={false}
        onPropose={jest.fn()}
      />,
    );
    expect(getByText(/等待队长组队（1 号座位）/)).toBeTruthy();
    expect(queryByTestId('avalon-nominate-submit')).toBeNull();
  });
});

/** 湖仙阶段条：持有人去座位盘选人、旁观者文案区分查验中/选择中、被查验者有弹窗重开入口。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonLadyView } from '../AvalonLadyView';

function ladyViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'lady',
    mySeat: 1,
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
      targetSeat: null,
      canCheck: true,
      needsAcknowledge: false,
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

describe('AvalonLadyView', () => {
  it('sends the holder to the seat board to pick a target', () => {
    const { getByText } = render(
      <AvalonLadyView viewModel={ladyViewModel()} onShowAcknowledge={jest.fn()} />,
    );
    expect(getByText(/在座位盘上选择查验目标/)).toBeTruthy();
    expect(getByText(/点座位盘点选/)).toBeTruthy();
  });

  it('tells spectators who is being checked (not the holder copy)', () => {
    const { getByText } = render(
      <AvalonLadyView
        viewModel={ladyViewModel({
          mySeat: 0,
          lady: {
            holderSeat: 1,
            examinedSeats: [1],
            targetSeat: 2,
            canCheck: false,
            needsAcknowledge: false,
          },
        })}
        onShowAcknowledge={jest.fn()}
      />,
    );
    expect(getByText(/正在查验3 号 · 玩家3，请等待/)).toBeTruthy();
  });

  it('gives the target a button to reopen the acknowledge modal', () => {
    const onShowAcknowledge = jest.fn();
    const { getByTestId } = render(
      <AvalonLadyView
        viewModel={ladyViewModel({
          mySeat: 2,
          lady: {
            holderSeat: 1,
            examinedSeats: [1],
            targetSeat: 2,
            canCheck: false,
            needsAcknowledge: true,
          },
        })}
        onShowAcknowledge={onShowAcknowledge}
      />,
    );
    fireEvent.press(getByTestId('avalon-lady-acknowledge-open'));
    expect(onShowAcknowledge).toHaveBeenCalledTimes(1);
  });
});

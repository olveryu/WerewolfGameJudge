/** 任务视图：投票亮票展示、秘密出牌不显示他人选择、好人只看到成功卡。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonQuestView } from '../AvalonQuestView';

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
    hasViewedRole: false,
    unviewedRoleSeats: [],
    requiredSize: null,
    proposedSeats: null,
    teamSeats: [0, 1],
    myBallot: null,
    ballots: { 0: 'approve', 1: 'approve', 2: 'reject' },
    voteCounts: { approve: 2, reject: 1, abstain: 0 },
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

describe('AvalonQuestView', () => {
  it('reveals each ballot in public vote mode', () => {
    const { getByTestId, getByText } = render(
      <AvalonQuestView viewModel={questViewModel()} onPlay={jest.fn()} />,
    );
    expect(getByTestId('avalon-vote-settlement-public')).toBeTruthy();
    expect(getByText('1 号 · 玩家1 · 赞成')).toBeTruthy();
    expect(getByText('3 号 · 玩家3 · 反对')).toBeTruthy();
  });

  it('only shows counts in secret vote mode', () => {
    const { getByTestId, queryByText } = render(
      <AvalonQuestView
        viewModel={questViewModel({ voteMode: 'secret', ballots: null })}
        onPlay={jest.fn()}
      />,
    );
    expect(getByTestId('avalon-vote-settlement-secret')).toBeTruthy();
    expect(queryByText('1 号 · 玩家1 · 赞成')).toBeNull();
  });

  it('only shows the success card to good players', () => {
    const { getByTestId, queryByTestId } = render(
      <AvalonQuestView viewModel={questViewModel({ myRole: 'merlin' })} onPlay={jest.fn()} />,
    );
    expect(getByTestId('avalon-quest-success')).toBeTruthy();
    expect(queryByTestId('avalon-quest-fail')).toBeNull();
  });

  it('shows both cards to evil players and reports the play', () => {
    const onPlay = jest.fn();
    const { getByTestId, getByText } = render(
      <AvalonQuestView viewModel={questViewModel({ myRole: 'morgana' })} onPlay={onPlay} />,
    );
    fireEvent.press(getByTestId('avalon-quest-fail'));
    expect(onPlay).toHaveBeenCalledWith('fail');
    expect(getByText('秘密出牌：点选一张卡，出牌人不公开。')).toBeTruthy();
  });

  it('shows the played state without revealing other plays', () => {
    const { getByText, queryByText } = render(
      <AvalonQuestView viewModel={questViewModel({ myPlay: 'success' })} onPlay={jest.fn()} />,
    );
    expect(getByText('已出牌（成功），结算前可改牌；出牌人不公开。')).toBeTruthy();
    expect(queryByText('失败')).toBeNull();
  });

  it('shows waiting copy to non-team members', () => {
    const { getByText } = render(
      <AvalonQuestView viewModel={questViewModel({ mySeat: 2 })} onPlay={jest.fn()} />,
    );
    expect(getByText('等待队员出牌…')).toBeTruthy();
  });
});

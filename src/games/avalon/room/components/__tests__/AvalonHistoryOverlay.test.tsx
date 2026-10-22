/**
 * 对局记录浮层：任务轨道与按任务分 tab 在前，结论横幅居中，提案与
 * 表决时间线在后；明细只用座位号；暗投不给逐人票；未结算提案只露
 * 进度与本人的一票；否决提案默认收起。
 */

import {
  type AvalonRoundRecordView,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render, within } from '@testing-library/react-native';

import { AvalonHistoryOverlay } from '../AvalonHistoryOverlay';

function historyViewModel(roundHistory: readonly AvalonRoundRecordView[]): AvalonViewModel {
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
    leaderSeat: 1,
    nightStep: null,
    evilPeers: null,
    merlinSees: null,
    percivalSees: null,
    nightConfirmed: false,
    hasViewedRole: true,
    unviewedRoleSeats: [],
    requiredSize: 2,
    draftSeats: null,
    proposedSeats: null,
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: ['success'],
    questHistory: [],
    roundHistory,
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
  };
}

const settledRound: AvalonRoundRecordView = {
  round: 1,
  proposals: [
    {
      leaderSeat: 0,
      teamSeats: [0, 1],
      ballots: { 0: 'approve', 1: 'reject', 2: 'reject', 3: 'reject', 4: 'approve' },
      approveCount: 2,
      rejectCount: 3,
      abstainCount: 0,
      approved: false,
    },
    {
      leaderSeat: 1,
      teamSeats: [1, 2],
      ballots: { 0: 'approve', 1: 'approve', 2: 'approve', 3: 'reject', 4: 'approve' },
      approveCount: 4,
      rejectCount: 1,
      abstainCount: 0,
      approved: true,
    },
  ],
  quest: { result: 'success', successCount: 2, failCount: 0 },
  vetoEnded: false,
  questProgress: null,
  currentProposal: null,
};

const openRound: AvalonRoundRecordView = {
  round: 2,
  proposals: [],
  quest: null,
  vetoEnded: false,
  questProgress: null,
  currentProposal: {
    leaderSeat: 2,
    teamSeats: [2, 3],
    castCount: 2,
    totalCount: 5,
    myBallot: 'approve',
  },
};

function renderOverlay(roundHistory: readonly AvalonRoundRecordView[]) {
  return render(
    <AvalonHistoryOverlay
      visible
      viewModel={historyViewModel(roundHistory)}
      onClose={() => undefined}
    />,
  );
}

describe('AvalonHistoryOverlay', () => {
  it('defaults to the latest round and switches rounds by tab', () => {
    const { getByTestId, queryByTestId } = renderOverlay([settledRound, openRound]);
    expect(getByTestId('avalon-history-round-2')).toBeTruthy();
    expect(queryByTestId('avalon-history-round-1')).toBeNull();
    expect(getByTestId('avalon-history-track-round-1').props.accessibilityLabel).toBe(
      '任务一，成功',
    );
    expect(getByTestId('avalon-history-track-round-2').props.accessibilityLabel).toBe(
      '任务二，进行中',
    );
    expect(getByTestId('avalon-history-track-round-5').props.accessibilityLabel).toBe(
      '任务五，未开始',
    );
    fireEvent.press(getByTestId('avalon-history-tab-1'));
    expect(getByTestId('avalon-history-round-1')).toBeTruthy();
    expect(queryByTestId('avalon-history-round-2')).toBeNull();
  });

  it('renders the settled quest banner, adopted card, and collapsed rejected proposal', () => {
    const { getByLabelText, getByTestId, getByText, queryByText } = renderOverlay([settledRound]);
    expect(getByText('任务一 · 成功')).toBeTruthy();
    expect(getByText('任务出牌结果（出牌人不公开）')).toBeTruthy();
    expect(getByText('成功牌')).toBeTruthy();
    expect(getByText('×2')).toBeTruthy();
    expect(getByText('失败牌')).toBeTruthy();
    expect(getByText('×0')).toBeTruthy();
    // 标签与计数绑在同一节点上断言：计数挂错牌面（成功牌挂失败数）时抓得到。
    expect(getByLabelText('成功牌 2 张')).toBeTruthy();
    expect(getByLabelText('失败牌 0 张')).toBeTruthy();
    expect(queryByText(/成功票|失败票/)).toBeNull();

    const adopted = within(getByTestId('avalon-history-proposal-1-2'));
    expect(adopted.getByText('通过 · 采用')).toBeTruthy();
    expect(adopted.getByText('赞成 4')).toBeTruthy();
    expect(adopted.getByText('反对 1')).toBeTruthy();
    expect(adopted.getByLabelText('1号，赞成')).toBeTruthy();
    expect(adopted.getByLabelText('2号，赞成')).toBeTruthy();
    expect(adopted.getByLabelText('3号，赞成')).toBeTruthy();
    expect(adopted.getByLabelText('4号，反对')).toBeTruthy();
    expect(adopted.getByLabelText('5号，赞成')).toBeTruthy();

    const rejected = within(getByTestId('avalon-history-proposal-1-1'));
    expect(rejected.getByText('否决')).toBeTruthy();
    expect(rejected.getByText('赞成 2 · 反对 3')).toBeTruthy();
    expect(rejected.queryByLabelText('1号，赞成')).toBeNull();
    expect(rejected.queryByLabelText('2号，反对')).toBeNull();
    fireEvent.press(getByTestId('avalon-history-proposal-1-1-toggle'));
    expect(rejected.getByLabelText('1号，赞成')).toBeTruthy();
    expect(rejected.getByLabelText('2号，反对')).toBeTruthy();
    expect(rejected.getByLabelText('3号，反对')).toBeTruthy();
    expect(rejected.getByLabelText('4号，反对')).toBeTruthy();
    expect(rejected.getByLabelText('5号，赞成')).toBeTruthy();

    // 只用座位号：玩家名不出现在记录里。
    expect(queryByText(/玩家/)).toBeNull();
  });

  it('labels the track node and quest cards of a failed quest', () => {
    const failedRound: AvalonRoundRecordView = {
      round: 1,
      proposals: [settledRound.proposals[1]!],
      quest: { result: 'fail', successCount: 1, failCount: 1 },
      vetoEnded: false,
      questProgress: null,
      currentProposal: null,
    };
    const { getByLabelText, getByTestId } = renderOverlay([failedRound]);
    expect(getByTestId('avalon-history-track-round-1').props.accessibilityLabel).toBe(
      '任务一，失败',
    );
    // 失败轮里两张牌计数均为 1：标签↔计数互换即挂。
    expect(getByLabelText('成功牌 1 张')).toBeTruthy();
    expect(getByLabelText('失败牌 1 张')).toBeTruthy();
  });

  it('keeps the leader out of the team row when the leader is not a team member', () => {
    const leaderOutsideTeamRound: AvalonRoundRecordView = {
      round: 1,
      proposals: [
        {
          leaderSeat: 2,
          teamSeats: [1, 4],
          ballots: { 0: 'approve', 1: 'approve', 2: 'approve', 3: 'approve', 4: 'approve' },
          approveCount: 5,
          rejectCount: 0,
          abstainCount: 0,
          approved: true,
        },
      ],
      quest: { result: 'success', successCount: 2, failCount: 0 },
      vetoEnded: false,
      questProgress: null,
      currentProposal: null,
    };
    const { getByTestId } = renderOverlay([leaderOutsideTeamRound]);
    const proposal = within(getByTestId('avalon-history-proposal-1-1'));
    const team = within(getByTestId('avalon-history-proposal-1-1-team'));
    expect(proposal.getByTestId('avalon-history-proposal-1-1-leader-seat-3')).toBeTruthy();
    expect(team.getByTestId('avalon-history-proposal-1-1-team-seat-2')).toBeTruthy();
    expect(team.getByTestId('avalon-history-proposal-1-1-team-seat-5')).toBeTruthy();
    expect(team.queryByTestId('avalon-history-proposal-1-1-team-seat-3')).toBeNull();
  });

  it('includes the leader in the team row only as a member when the leader is on the team', () => {
    const { getByTestId } = renderOverlay([settledRound]);
    const adopted = within(getByTestId('avalon-history-proposal-1-2'));
    const team = within(getByTestId('avalon-history-proposal-1-2-team'));
    expect(adopted.getByTestId('avalon-history-proposal-1-2-leader-seat-2')).toBeTruthy();
    expect(team.getByTestId('avalon-history-proposal-1-2-team-seat-2')).toBeTruthy();
    expect(team.getByTestId('avalon-history-proposal-1-2-team-seat-3')).toBeTruthy();
    expect(team.queryByTestId('avalon-history-proposal-1-2-team-seat-1')).toBeNull();
  });

  it('keeps per-seat ballots hidden in secret mode', () => {
    const secretRound: AvalonRoundRecordView = {
      ...settledRound,
      proposals: settledRound.proposals.map((proposal) => ({ ...proposal, ballots: null })),
    };
    const { getAllByText, getByTestId, queryByLabelText } = renderOverlay([secretRound]);
    // 被采用卡直接说明暗投口径；被否决行展开后同样只给计数与说明。
    expect(getAllByText('暗投模式不公布逐人票')).toHaveLength(1);
    expect(queryByLabelText('1号，赞成')).toBeNull();
    fireEvent.press(getByTestId('avalon-history-proposal-1-1-toggle'));
    expect(getAllByText('暗投模式不公布逐人票')).toHaveLength(2);
    expect(queryByLabelText('1号，赞成')).toBeNull();
    expect(queryByLabelText('2号，反对')).toBeNull();
  });

  it('shows only progress and the viewer ballot for the open proposal', () => {
    const { getByText, queryByTestId, queryByText } = renderOverlay([openRound]);
    expect(getByText('任务二 · 组队投票中')).toBeTruthy();
    expect(getByText('第1次提案 · 进行中（已投 2/5）')).toBeTruthy();
    expect(getByText('你投了：赞成')).toBeTruthy();
    expect(queryByTestId('avalon-history-current-proposal-2-team')).toBeNull();
    expect(queryByText(/第1次提案 · 组队者/)).toBeNull();
    expect(queryByText(/1号，赞成/)).toBeNull();
  });

  it('renders quest progress while the quest is open', () => {
    const questRound: AvalonRoundRecordView = {
      round: 1,
      proposals: [settledRound.proposals[1]!],
      quest: null,
      vetoEnded: false,
      questProgress: { playedCount: 1, teamSize: 2 },
      currentProposal: null,
    };
    const { getAllByTestId, getByText } = renderOverlay([questRound]);
    expect(getByText('任务一 · 任务执行中')).toBeTruthy();
    expect(getByText('已出牌 1/2')).toBeTruthy();
    expect(getAllByTestId('avalon-history-proposal-1-1-team')).toHaveLength(1);
    const team = within(getAllByTestId('avalon-history-proposal-1-1-team')[0]!);
    expect(team.getByTestId('avalon-history-proposal-1-1-team-seat-2')).toBeTruthy();
    expect(team.getByTestId('avalon-history-proposal-1-1-team-seat-3')).toBeTruthy();
  });

  it('renders the veto-ended closing banner without a quest', () => {
    const vetoRound: AvalonRoundRecordView = {
      round: 1,
      proposals: [
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
      ],
      quest: null,
      vetoEnded: true,
      questProgress: null,
      currentProposal: null,
    };
    const { getByTestId, getByText, queryByLabelText } = renderOverlay([vetoRound]);
    expect(getByText('组队失败')).toBeTruthy();
    expect(getByText('5 次否决达上限，本轮无任务')).toBeTruthy();
    for (let index = 1; index <= 5; index += 1) {
      expect(getByTestId(`avalon-history-proposal-1-${index}`)).toBeTruthy();
    }
    expect(queryByLabelText('1号，赞成')).toBeNull();
  });

  it('renders an empty state before any round starts', () => {
    const { getByText } = renderOverlay([]);
    expect(getByText('暂无对局记录。')).toBeTruthy();
  });
});

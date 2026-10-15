/**
 * 对局记录浮层：按任务分 tab（默认当前轮）、任务区在前投票区在后、
 * 明细只用座位号；暗投不给逐人票；未结算提案只露进度与本人的一票。
 */

import {
  type AvalonRoundRecordView,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';

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
    fireEvent.press(getByTestId('avalon-history-tab-1'));
    expect(getByTestId('avalon-history-round-1')).toBeTruthy();
    expect(queryByTestId('avalon-history-round-2')).toBeNull();
  });

  it('renders the settled quest first, then proposals with seat-number detail', () => {
    const { getAllByText, getByText, queryByText } = renderOverlay([settledRound]);
    expect(getByText('任务一 · 成功（成功票 2 · 失败票 0）')).toBeTruthy();
    // 任务区队伍行带队长标记（队长 = 通过提案的 2 号）；提案块队伍行是同一支队伍。
    expect(getByText('队伍：2号（队长） 2号 3号')).toBeTruthy();
    expect(getAllByText('队伍：2号 3号')).toHaveLength(1);
    expect(getByText('队伍：1号 2号')).toBeTruthy();
    expect(getByText('第1次提案 · 队长 1号')).toBeTruthy();
    expect(getByText('赞成 2 · 反对 3 → 否决')).toBeTruthy();
    expect(getByText('第2次提案 · 队长 2号')).toBeTruthy();
    expect(getByText('赞成 4 · 反对 1 → 通过')).toBeTruthy();
    // 1 号在两次提案都投赞成，明细行出现两次；2 号只在第 1 次投反对。
    expect(getAllByText('1号 → 赞成')).toHaveLength(2);
    expect(getByText('2号 → 反对')).toBeTruthy();
    // 只用座位号：玩家名不出现在记录里。
    expect(queryByText(/玩家/)).toBeNull();
  });

  it('keeps per-seat ballots hidden in secret mode', () => {
    const secretRound: AvalonRoundRecordView = {
      ...settledRound,
      proposals: settledRound.proposals.map((proposal) => ({ ...proposal, ballots: null })),
    };
    const { getAllByText, getByText, queryByText } = renderOverlay([secretRound]);
    // 每条提案各给一次暗投说明。
    expect(getAllByText('暗投模式不公布逐人票')).toHaveLength(2);
    expect(queryByText('1号 → 赞成')).toBeNull();
    expect(getByText('赞成 2 · 反对 3 → 否决')).toBeTruthy();
  });

  it('shows only progress and the viewer ballot for the open proposal', () => {
    const { getByText, queryByText } = renderOverlay([openRound]);
    expect(getByText('任务二 · 组队投票中')).toBeTruthy();
    expect(getByText('第1次提案 · 队长 3号')).toBeTruthy();
    expect(getByText('队伍：3号 4号')).toBeTruthy();
    expect(getByText('进行中（已投 2/5）')).toBeTruthy();
    expect(getByText('你投了：赞成')).toBeTruthy();
    expect(queryByText(/→ 赞成/)).toBeNull();
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
    const { getAllByText, getByText } = renderOverlay([questRound]);
    expect(getByText('任务一 · 任务执行中（已出牌 1/2）')).toBeTruthy();
    // 任务区队伍行带队长标记；促成任务的提案块队伍行是同一支队伍。
    expect(getByText('队伍：2号（队长） 2号 3号')).toBeTruthy();
    expect(getAllByText('队伍：2号 3号')).toHaveLength(1);
  });

  it('renders the veto-ended closing line without a quest', () => {
    const vetoRound: AvalonRoundRecordView = {
      round: 1,
      proposals: [
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
        settledRound.proposals[0]!,
      ],
      quest: null,
      vetoEnded: true,
      questProgress: null,
      currentProposal: null,
    };
    const { getByText } = renderOverlay([vetoRound]);
    expect(getByText('组队失败：3 次否决达上限，本轮无任务')).toBeTruthy();
  });

  it('renders an empty state before any round starts', () => {
    const { getByText } = renderOverlay([]);
    expect(getByText('暂无对局记录。')).toBeTruthy();
  });
});

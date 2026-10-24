/**
 * 阿瓦隆本局复盘：终局结论、刺杀命中与未命中、身份左右列、配置行、
 * 湖仙完整版与未发生原因、被打断轮、暗投无逐人票；非终局不渲染。
 */

import type {
  AvalonRoundRecordView,
  AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { render, within } from '@testing-library/react-native';

import { AvalonReviewOverlay } from '../AvalonReviewOverlay';

const ROLES_5 = ['merlin', 'percival', 'loyalServant', 'morgana', 'assassin'] as const;

function reviewViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  const settledRound: AvalonRoundRecordView = {
    round: 1,
    proposals: [
      {
        leaderSeat: 0,
        teamSeats: [0, 1],
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
  const settledRound2: AvalonRoundRecordView = {
    ...settledRound,
    round: 2,
    quest: { result: 'success', successCount: 3, failCount: 0 },
  };
  const interruptedRound: AvalonRoundRecordView = {
    round: 3,
    proposals: [
      {
        leaderSeat: 4,
        teamSeats: [0, 1, 4],
        ballots: { 0: 'approve', 1: 'approve', 2: 'reject', 3: 'reject', 4: 'reject' },
        approveCount: 2,
        rejectCount: 3,
        abstainCount: 0,
        approved: false,
      },
    ],
    quest: null,
    vetoEnded: false,
    questProgress: null,
    currentProposal: null,
  };
  return {
    phase: 'ended',
    mySeat: 0,
    myRole: 'merlin',
    seats: ROLES_5.map((role, seat) => ({
      seat,
      displayName: `玩家${seat + 1}`,
      isBot: false,
      isLeader: seat === 0,
      role,
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
    draftSeats: null,
    proposedSeats: null,
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: ['success', 'success'],
    questHistory: [],
    roundHistory: [settledRound, settledRound2, interruptedRound],
    lady: null,
    ladyCheckResult: null,
    ladyHistory: [{ afterRound: 2, holderSeat: 1, targetSeat: 3 }],
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: 0,
    winner: 'evil',
    endReason: 'assassinationHit',
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'secret',
    playerCount: 5,
    lastVoteResult: null,
    ...overrides,
  };
}

function renderReview(overrides: Partial<AvalonViewModel> = {}) {
  return render(
    <AvalonReviewOverlay
      visible
      viewModel={reviewViewModel(overrides)}
      onClose={() => undefined}
    />,
  );
}

describe('AvalonReviewOverlay', () => {
  it('renders the ended conclusion with the assassin line on a hit', () => {
    const { getByTestId, getByText } = renderReview();
    const conclusion = within(getByTestId('avalon-review-conclusion'));
    expect(conclusion.getByText('坏人获胜', { exact: true })).toBeTruthy();
    expect(conclusion.getByText('刺客指认出了梅林')).toBeTruthy();
    expect(getByText('刺客 5 号指认 1 号（梅林）→ 命中')).toBeTruthy();
  });

  it('renders the miss line and the good win on an early assassination miss', () => {
    const { getByText } = renderReview({
      winner: 'good',
      endReason: 'earlyAssassinationMiss',
      accusedSeat: 2,
    });
    expect(getByText('好人获胜', { exact: true })).toBeTruthy();
    expect(getByText('提前刺杀失手')).toBeTruthy();
    expect(getByText('刺客 5 号指认 3 号（忠臣）→ 未命中')).toBeTruthy();
  });

  it('renders identities as structured rows, not dot-joined strings', () => {
    const { getByTestId, queryByText } = renderReview();
    const identities = within(getByTestId('avalon-review-identities'));
    expect(identities.getByTestId('avalon-review-identity-0')).toBeTruthy();
    expect(identities.getByText('玩家1')).toBeTruthy();
    expect(identities.getByText('梅林（好人）')).toBeTruthy();
    expect(identities.getByText('刺客（坏人）')).toBeTruthy();
    expect(queryByText(/1 号 · 玩家1 ·/)).toBeNull();
  });

  it('renders the config line, lake enablement, and role groups', () => {
    const roles10 = [
      'merlin',
      'percival',
      'loyalServant',
      'loyalServant',
      'loyalServant',
      'loyalServant',
      'morgana',
      'assassin',
      'oberon',
      'mordred',
    ] as const;
    const { getByText } = renderReview({
      playerCount: 10,
      seats: roles10.map((role, seat) => ({
        seat,
        displayName: `玩家${seat + 1}`,
        isBot: false,
        isLeader: seat === 0,
        role,
      })),
    });
    expect(getByText('投票暗投 · 否决上限 5 · 任务人数 3 / 4 / 4 / 5 / 5')).toBeTruthy();
    expect(getByText('湖仙启用')).toBeTruthy();
    expect(getByText('梅林')).toBeTruthy();
    expect(getByText('忠臣 ×4')).toBeTruthy();
  });

  it('renders the complete lake list with unoccurred reasons', () => {
    const { getByTestId, getAllByText, queryByText } = renderReview();
    // 湖仙完整版与任务进程里的轮次湖仙节是同一共享件的两处渲染，
    // 故完整版内的断言必须限定在 avalon-review-lake 容器里。
    const lake = within(getByTestId('avalon-review-lake'));
    expect(lake.getByTestId('avalon-review-lake-2')).toBeTruthy();
    // 复盘必带查验结果：mock 里被查 4 号（座位 3）是莫甘娜 → 坏人；
    // 且复盘里不出现记录那句“结果只给持有人看”说明。
    expect(lake.getByText('2 号查验了 4 号（坏人）')).toBeTruthy();
    expect(lake.getByText('→ 新持有人 4 号')).toBeTruthy();
    expect(lake.getByText('未发生（提前刺杀打断）')).toBeTruthy();
    expect(lake.getByText('未发生（任务未开始）')).toBeTruthy();
    expect(queryByText('查验结果只给当时持有人看，不进记录。')).toBeNull();
    // 任务进程里同轮的轮末湖仙节同样带结果（两处渲染同一共享件）。
    expect(getAllByText('2 号查验了 4 号（坏人）')).toHaveLength(2);
  });

  it('renders the interrupted round and the ended track in the quest process', () => {
    const { getByTestId, getByText } = renderReview();
    expect(getByText('任务三 · 未完成')).toBeTruthy();
    expect(getByTestId('avalon-review-track-round-3').props.accessibilityLabel).toBe(
      '任务三，未完成',
    );
    expect(getByTestId('avalon-review-track-round-5').props.accessibilityLabel).toBe(
      '任务五，未开始（提前结束）',
    );
  });

  it('shows no per-seat ballots and no toggle in secret mode', () => {
    const darkRounds = reviewViewModel().roundHistory.map((record) => ({
      ...record,
      proposals: record.proposals.map((proposal) => ({ ...proposal, ballots: null })),
    }));
    const { getAllByText, queryByLabelText, queryByTestId } = renderReview({
      roundHistory: darkRounds,
    });
    expect(getAllByText('暗投模式不公布逐人票').length).toBeGreaterThan(0);
    expect(queryByTestId('avalon-review-proposal-3-1-toggle')).toBeNull();
    expect(queryByLabelText('1号，赞成')).toBeNull();
  });

  it('renders nothing before the game ends', () => {
    const { queryByTestId } = renderReview({ phase: 'nominate', winner: null, endReason: null });
    expect(queryByTestId('avalon-review-conclusion')).toBeNull();
    expect(queryByTestId('avalon-review-identities')).toBeNull();
  });
});

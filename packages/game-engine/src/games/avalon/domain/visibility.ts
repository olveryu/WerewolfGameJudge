/** Avalon per-seat view model: private night info is cropped by the viewer's role (UI-level privacy, D6-Q1). */

import { listUnviewedSeats } from '../../../platform/room/identityViewing';
import { isBotOccupant } from '../../../platform/room/seating';
import {
  type AvalonBallot,
  type AvalonEndReason,
  type AvalonNightStep,
  type AvalonPhaseKind,
  type AvalonPlay,
  type AvalonQuestHistoryEntry,
  type AvalonQuestRecord,
  type AvalonQuestRound,
  type AvalonRoleId,
  type AvalonState,
  type AvalonVoteMode,
  getAvalonBotDisplayName,
  getAvalonOccupiedSeatCount,
  getAvalonViewingParticipants,
  isAvalonBotSeat,
  isAvalonEvilRole,
  isAvalonOccupiedSeat,
} from '../state/types';
import { getAvalonNightParticipants } from './rules';

export interface AvalonSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isLeader: boolean;
  /** 终局揭晓前为 null（刺杀阶段不亮牌，D11）。 */
  readonly role: AvalonRoleId | null;
}

export interface AvalonQuestHistoryView {
  readonly round: AvalonQuestHistoryEntry['round'];
  readonly leaderSeat: number;
  readonly teamSeats: readonly number[];
  /** 暗投模式下为 null（只公布数量，D7）。 */
  readonly ballots: Readonly<Record<number, AvalonBallot>> | null;
  readonly approveCount: number;
  readonly rejectCount: number;
  readonly abstainCount: number;
  readonly result: 'success' | 'fail';
  readonly successCount: number;
  readonly failCount: number;
}

/** 对局记录中一条已结算提案的 view：暗投模式 ballots 为 null 只给数量（D7，与 questHistory 同口径）。 */
export interface AvalonProposalRecordView {
  readonly leaderSeat: number;
  readonly teamSeats: readonly number[];
  readonly ballots: Readonly<Record<number, AvalonBallot>> | null;
  readonly approveCount: number;
  readonly rejectCount: number;
  readonly abstainCount: number;
  readonly approved: boolean;
}

/** 正在投票的提案（未结算）：只给进度与本人的一票，任何人的票都不外泄。 */
export interface AvalonCurrentProposalView {
  readonly leaderSeat: number;
  readonly teamSeats: readonly number[];
  readonly castCount: number;
  readonly totalCount: number;
  readonly myBallot: AvalonBallot | null;
}

/** 对局记录一轮的 view：已结算提案 + 任务结论 + 进行中信息，浮层按轮分 tab 渲染。 */
export interface AvalonRoundRecordView {
  readonly round: AvalonQuestRound;
  readonly proposals: readonly AvalonProposalRecordView[];
  /** 任务结论；尚未出任务（组队中 / 被否决收尾）为 null。暗投只给票数，出牌人不揭晓。 */
  readonly quest: AvalonQuestRecord | null;
  /** 本轮因连续否决达上限终局（仅终局轮为 true）。 */
  readonly vetoEnded: boolean;
  /** 任务进行中进度（已出牌数 / 队伍人数）；非本轮任务阶段为 null。 */
  readonly questProgress: {
    readonly playedCount: number;
    readonly teamSize: number;
  } | null;
  /** 正在投票的提案；非本轮投票阶段为 null。 */
  readonly currentProposal: AvalonCurrentProposalView | null;
}

export interface AvalonLadyView {
  readonly holderSeat: number;
  readonly examinedSeats: readonly number[];
  readonly targetSeat: number | null;
  readonly canCheck: boolean;
  readonly needsAcknowledge: boolean;
}

/** 投票结算面板用 view：暗投模式 ballots 为 null 只给数量（D7）。 */
export interface AvalonLastVoteResultView {
  readonly approved: boolean;
  readonly rejectStreak: number;
  readonly ballots: Readonly<Record<number, AvalonBallot>> | null;
  readonly approveCount: number;
  readonly rejectCount: number;
  readonly abstainCount: number;
}

/** 湖仙查验结果的持有人视图：被查验座位与其阵营。 */
export interface AvalonLadyCheckResultView {
  readonly targetSeat: number;
  readonly faction: 'good' | 'evil';
}

export interface AvalonViewModel {
  readonly phase: AvalonPhaseKind;
  readonly mySeat: number | null;
  readonly myRole: AvalonRoleId | null;
  readonly seats: readonly AvalonSeatView[];
  readonly leaderSeat: number | null;
  readonly nightStep: AvalonNightStep | null;
  /** 坏人互认（奥伯伦为空数组）；梅林/派西维尔/他人为 null。 */
  readonly evilPeers: readonly number[] | null;
  /** 梅林看到的坏人（不含莫德雷德）；他人为 null。 */
  readonly merlinSees: readonly number[] | null;
  /** 派西维尔看到的梅林 + 莫甘娜；他人为 null。 */
  readonly percivalSees: readonly number[] | null;
  readonly nightConfirmed: boolean;
  /** 身份查看协议：本人是否已查看自己的角色（揭示动画锚点）。 */
  readonly hasViewedRole: boolean;
  /** 尚未查看角色的座位（公开信息，与狼人杀 roster 口径一致）。 */
  readonly unviewedRoleSeats: readonly number[];
  readonly requiredSize: number | null;
  readonly proposedSeats: readonly number[] | null;
  readonly teamSeats: readonly number[] | null;
  readonly myBallot: AvalonBallot | null;
  /** 公投模式亮票后全员可见；暗投模式为 null（D7）。 */
  readonly ballots: Readonly<Record<number, AvalonBallot>> | null;
  readonly voteCounts: {
    readonly approve: number;
    readonly reject: number;
    readonly abstain: number;
  } | null;
  readonly myPlay: AvalonPlay | null;
  readonly questResults: ReadonlyArray<'success' | 'fail'>;
  readonly questHistory: readonly AvalonQuestHistoryView[];
  /** 对局记录（按轮）：含已开始的当前轮；大厅 / 查看 / 夜晚阶段为空。 */
  readonly roundHistory: readonly AvalonRoundRecordView[];
  readonly lady: AvalonLadyView | null;
  /** 最近一次湖仙查验结果（目标座位 + 阵营），仅查验时的持有人可见。 */
  readonly ladyCheckResult: AvalonLadyCheckResultView | null;
  readonly isAssassin: boolean;
  /** D13：night 结束后、终局前，刺客端常驻刺杀按钮。 */
  readonly canEarlyStrike: boolean;
  readonly accusedSeat: number | null;
  readonly winner: 'good' | 'evil' | null;
  readonly endReason: AvalonEndReason | null;
  readonly rejectStreak: number;
  readonly vetoLimit: number;
  readonly voteMode: AvalonVoteMode;
  /** 最近一次组队投票结算面板数据；新一轮提案后为 null。 */
  readonly lastVoteResult: AvalonLastVoteResultView | null;
}

function seatDisplayName(state: AvalonState, seat: number): string {
  const occupant = state.roster[seat];
  if (occupant != null && !isBotOccupant(occupant)) return occupant.profile.displayName;
  return getAvalonBotDisplayName(seat);
}

function buildSeatViews(state: AvalonState): AvalonSeatView[] {
  const views: AvalonSeatView[] = [];
  const revealed = state.phase.kind === 'ended';
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (!isAvalonOccupiedSeat(state, seat)) continue;
    views.push({
      seat,
      displayName: seatDisplayName(state, seat),
      isBot: isAvalonBotSeat(state, seat),
      isLeader: state.leaderSeat === seat,
      role: revealed ? (state.roles[seat] ?? null) : null,
    });
  }
  return views;
}

/**
 * 对局记录投影：已落盘轮次 + 已开始的当前轮（组队 / 投票 / 任务 / 湖仙
 * 阶段）。已结算提案结算即全公开（暗投仍只给数量，D7）；进行中的提案
 * 只露进度与查看者本人的一票；任务结论只带票数，永不带出牌人。
 */
function roundRecordViews(
  state: AvalonState,
  viewerSeat: number | null,
): readonly AvalonRoundRecordView[] {
  const showBallots = state.config.voteMode === 'public';
  const phase = state.phase;
  const currentRound: AvalonQuestRound | null =
    phase.kind === 'nominate' || phase.kind === 'vote' || phase.kind === 'quest'
      ? phase.round
      : phase.kind === 'lady'
        ? phase.afterRound
        : null;
  const questProgress =
    phase.kind === 'quest'
      ? {
          round: phase.round,
          playedCount: Object.keys(phase.plays).length,
          teamSize: phase.teamSeats.length,
        }
      : null;
  const currentProposal: (AvalonCurrentProposalView & { readonly round: AvalonQuestRound }) | null =
    phase.kind === 'vote'
      ? {
          round: phase.round,
          leaderSeat: state.leaderSeat,
          teamSeats: phase.proposedSeats,
          castCount: Object.keys(phase.ballots).length,
          totalCount: getAvalonOccupiedSeatCount(state),
          myBallot: viewerSeat === null ? null : (phase.ballots[viewerSeat] ?? null),
        }
      : null;
  const vetoRound =
    phase.kind === 'ended' && phase.reason === 'vetoLimitReached'
      ? (state.roundHistory[state.roundHistory.length - 1]?.round ?? null)
      : null;
  const rounds = new Set<AvalonQuestRound>(state.roundHistory.map((record) => record.round));
  if (currentRound !== null) rounds.add(currentRound);
  return [...rounds]
    .sort((a, b) => a - b)
    .map((round) => {
      const record = state.roundHistory.find((candidate) => candidate.round === round);
      return {
        round,
        proposals: (record?.proposals ?? []).map((proposal) => ({
          leaderSeat: proposal.leaderSeat,
          teamSeats: proposal.teamSeats,
          ballots: showBallots ? proposal.ballots : null,
          approveCount: proposal.approveCount,
          rejectCount: proposal.rejectCount,
          abstainCount: proposal.abstainCount,
          approved: proposal.approved,
        })),
        quest: record?.quest ?? null,
        vetoEnded: vetoRound === round,
        questProgress:
          questProgress !== null && questProgress.round === round
            ? { playedCount: questProgress.playedCount, teamSize: questProgress.teamSize }
            : null,
        currentProposal:
          currentProposal !== null && currentProposal.round === round
            ? {
                leaderSeat: currentProposal.leaderSeat,
                teamSeats: currentProposal.teamSeats,
                castCount: currentProposal.castCount,
                totalCount: currentProposal.totalCount,
                myBallot: currentProposal.myBallot,
              }
            : null,
      };
    });
}

function historyViews(state: AvalonState): readonly AvalonQuestHistoryView[] {
  const showBallots = state.config.voteMode === 'public';
  return state.questHistory.map((entry) => ({
    round: entry.round,
    leaderSeat: entry.leaderSeat,
    teamSeats: entry.teamSeats,
    ballots: showBallots ? entry.ballots : null,
    approveCount: entry.approveCount,
    rejectCount: entry.rejectCount,
    abstainCount: entry.abstainCount,
    result: entry.result,
    successCount: entry.successCount,
    failCount: entry.failCount,
  }));
}

/**
 * Builds the cropped view model for one viewer (UI-level privacy, D6-Q1).
 * @param viewerSeat Seat of the viewer; null for spectators without a seat.
 */
export function getAvalonViewModel(state: AvalonState, viewerSeat: number | null): AvalonViewModel {
  const phase = state.phase;
  const myRole = viewerSeat === null ? null : (state.roles[viewerSeat] ?? null);
  const isAssassin = myRole === 'assassin';

  let nightStep: AvalonNightStep | null = null;
  let evilPeers: readonly number[] | null = null;
  let merlinSees: readonly number[] | null = null;
  let percivalSees: readonly number[] | null = null;
  let nightConfirmed = false;
  let requiredSize: number | null = null;
  let proposedSeats: readonly number[] | null = null;
  let teamSeats: readonly number[] | null = null;
  let myBallot: AvalonBallot | null = null;
  let ballots: Readonly<Record<number, AvalonBallot>> | null = null;
  let voteCounts: AvalonViewModel['voteCounts'] = null;
  let myPlay: AvalonPlay | null = null;
  let lady: AvalonLadyView | null = null;

  if (phase.kind === 'night') {
    nightStep = phase.step;
    if (viewerSeat !== null) {
      nightConfirmed = phase.confirmedSeats.includes(viewerSeat);
      const participants = getAvalonNightParticipants(state.roles, phase.step);
      if (participants.includes(viewerSeat) && myRole !== null) {
        if (phase.step === 'evilReveal' && isAvalonEvilRole(myRole)) {
          evilPeers = state.nightInfo.evilPeers[viewerSeat] ?? [];
        } else if (phase.step === 'merlinReveal' && myRole === 'merlin') {
          merlinSees = state.nightInfo.merlinSees;
        } else if (phase.step === 'percivalReveal' && myRole === 'percival') {
          percivalSees = state.nightInfo.percivalSees;
        }
      }
    }
  } else if (phase.kind === 'nominate') {
    requiredSize = phase.requiredSize;
    proposedSeats = null;
  } else if (phase.kind === 'vote') {
    proposedSeats = phase.proposedSeats;
    myBallot = viewerSeat === null ? null : (phase.ballots[viewerSeat] ?? null);
  } else if (phase.kind === 'quest') {
    teamSeats = phase.teamSeats;
    myPlay = viewerSeat === null ? null : (phase.plays[viewerSeat] ?? null);
    // 亮票：公投模式全员可见个人投票，暗投模式只公布数量（D7）。
    if (state.config.voteMode === 'public') {
      ballots = phase.ballots;
    }
    voteCounts = {
      approve: phase.approveCount,
      reject: phase.rejectCount,
      abstain: phase.abstainCount,
    };
  } else if (phase.kind === 'lady') {
    lady = {
      holderSeat: phase.holderSeat,
      examinedSeats: phase.examinedSeats,
      targetSeat: phase.targetSeat,
      canCheck: viewerSeat === phase.holderSeat && phase.targetSeat === null,
      needsAcknowledge: viewerSeat === phase.targetSeat,
    };
  }

  const lastCheck = state.lastLadyCheck;
  const ladyCheckResult =
    lastCheck !== null && viewerSeat === lastCheck.holderSeat
      ? { targetSeat: lastCheck.targetSeat, faction: lastCheck.faction }
      : null;

  // 投票结算面板：公投亮逐人投票，暗投只给汇总数量（D7）。
  const lastVote = state.lastVoteResult;
  const lastVoteResult: AvalonLastVoteResultView | null =
    lastVote === null
      ? null
      : {
          approved: lastVote.approved,
          rejectStreak: lastVote.rejectStreak,
          ballots: state.config.voteMode === 'public' ? lastVote.ballots : null,
          approveCount: lastVote.approveCount,
          rejectCount: lastVote.rejectCount,
          abstainCount: lastVote.abstainCount,
        };

  return {
    phase: phase.kind,
    mySeat: viewerSeat,
    myRole,
    seats: buildSeatViews(state),
    leaderSeat: state.leaderSeat >= 0 ? state.leaderSeat : null,
    nightStep,
    evilPeers,
    merlinSees,
    percivalSees,
    nightConfirmed,
    hasViewedRole: viewerSeat !== null && state.roleViewedSeats.includes(viewerSeat),
    // Every seat whose record is missing, bots included: the host
    // clears bot entries with the scaffold action.
    unviewedRoleSeats: listUnviewedSeats(
      getAvalonViewingParticipants(state),
      state.roleViewedSeats,
    ).map((participant) => participant.seat),
    requiredSize,
    proposedSeats,
    teamSeats,
    myBallot,
    ballots,
    voteCounts,
    myPlay,
    questResults: state.questResults,
    questHistory: historyViews(state),
    roundHistory: roundRecordViews(state, viewerSeat),
    lady,
    ladyCheckResult,
    isAssassin,
    canEarlyStrike:
      isAssassin &&
      (phase.kind === 'nominate' ||
        phase.kind === 'vote' ||
        phase.kind === 'quest' ||
        phase.kind === 'lady'),
    accusedSeat: phase.kind === 'ended' ? phase.accusedSeat : null,
    winner: phase.kind === 'ended' ? phase.winner : null,
    endReason: phase.kind === 'ended' ? phase.reason : null,
    rejectStreak: state.rejectStreak,
    vetoLimit: state.config.vetoLimit,
    voteMode: state.config.voteMode,
    lastVoteResult,
  };
}

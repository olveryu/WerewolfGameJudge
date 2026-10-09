/** Avalon per-seat view model: private night info is cropped by the viewer's role (UI-level privacy, D6-Q1). */

import { listUnviewedSeats } from '../../../platform/room/identityViewing';
import {
  type AvalonBallot,
  type AvalonEndReason,
  type AvalonHumanSeat,
  type AvalonNightStep,
  type AvalonPhaseKind,
  type AvalonPlay,
  type AvalonQuestHistoryEntry,
  type AvalonRoleId,
  type AvalonState,
  type AvalonVoteMode,
  getAvalonBotDisplayName,
  getAvalonViewingParticipants,
  isAvalonEvilRole,
  isAvalonImplicitBotSeat,
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
  readonly lady: AvalonLadyView | null;
  /** 最近一次湖仙查验结果，仅查验时的持有人可见。 */
  readonly ladyCheckResult: 'good' | 'evil' | null;
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
  const occupant: AvalonHumanSeat | undefined = state.realSeats[seat];
  if (occupant !== undefined) return occupant.profile.displayName;
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
      isBot: isAvalonImplicitBotSeat(state, seat),
      isLeader: state.leaderSeat === seat,
      role: revealed ? (state.roles[seat] ?? null) : null,
    });
  }
  return views;
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
    lastCheck !== null && viewerSeat === lastCheck.holderSeat ? lastCheck.faction : null;

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
    unviewedRoleSeats: listUnviewedSeats(getAvalonViewingParticipants(state), state.roleViewedSeats)
      .filter((participant) => !participant.isBot)
      .map((participant) => participant.seat),
    requiredSize,
    proposedSeats,
    teamSeats,
    myBallot,
    ballots,
    voteCounts,
    myPlay,
    questResults: state.questResults,
    questHistory: historyViews(state),
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

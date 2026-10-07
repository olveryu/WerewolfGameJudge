/** Avalon decision outcomes and permission gates; no IO. */

import {
  type CommandContext,
  commit,
  type Decision,
  reject,
  resolveHostActorId,
  resolveUserActorId,
} from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
} from '../../../platform/protocol/reasons';
import type { SeatChange } from '../../../platform/room/seating';
import { findSeatByUserId } from '../../../platform/room/seating';
import type {
  AvalonBallot,
  AvalonEndReason,
  AvalonHumanSeat,
  AvalonNightInfo,
  AvalonNightStep,
  AvalonPlay,
  AvalonQuestHistoryEntry,
  AvalonQuestRound,
  AvalonRoleId,
} from '../state/types';
import { type AvalonState, isAvalonImplicitBotSeat } from '../state/types';

/** 失败文案逐字照搬设计稿 §6.1（中文，走 AlertModal）。 */
export const AVALON_REASONS = {
  config: '阿瓦隆配置无效',
  phase: '当前阶段不能执行此操作',
  notHostStart: '只有房主可以开始游戏',
  full: '请先坐满所有座位，或填充机器人。',
  notNightParticipant: '你不在当前确认步骤内',
  notLeader: '只有当前队长可以组队',
  notVotePhase: '当前不在投票阶段',
  notHostFinishVote: '只有房主可以结束投票',
  notTeamMember: '你不在本轮任务队伍中',
  goodMustSucceed: '好人只能出成功牌',
  notHostFinishQuest: '只有房主可以结束任务',
  notLadyHolder: '只有湖仙持有人可以查验',
  ladyAlreadyExamined: '该玩家已担任过湖仙，不能查验',
  ladyCannotCheckSelf: '不能查验自己',
  notLadyTarget: '只有被查验者可以确认',
  notAssassinAccuse: '只有刺客可以指认',
  cannotAccuseSelf: '不能指认自己',
  notAssassinStrike: '只有刺客可以刺杀',
  noStrikeAtNight: '晚上阶段不能刺杀',
  cannotStrikeSelf: '不能刺杀自己',
  notHostReturnToLobby: '只有房主可以返回大厅',
  occupied: '目标人数之外的座位仍有玩家入座，请先让这些玩家离座',
  invalidSeats: '队员必须是已入座的玩家',
  duplicateSeats: '队员不能重复',
  invalidVote: '投票选项无效',
  invalidPlay: '出牌选项无效',
  invalidTarget: '目标座位无效',
  controlledSeatNotBot: '只能接管机器人席位',
} as const;

/** 队员人数文案带数量占位（§6.1："队员人数必须为 X 人"）。 */
export function teamSizeReason(requiredSize: number): string {
  return `队员人数必须为 ${requiredSize} 人`;
}

export type AvalonEvent =
  | {
      readonly type: 'avalon.seats.changed';
      readonly changes: readonly SeatChange<AvalonHumanSeat>[];
      readonly excludedBotSeats: readonly number[];
      readonly fillEmptySeatsWithBots: boolean;
    }
  | { readonly type: 'avalon.config.updated'; readonly config: AvalonState['config'] }
  | {
      readonly type: 'avalon.game.started';
      readonly roles: Readonly<Record<number, AvalonRoleId>>;
      readonly nightInfo: AvalonNightInfo;
      readonly leaderSeat: number;
      readonly ladyHolderSeat: number | null;
      readonly gameSequence: number;
    }
  | { readonly type: 'avalon.night.confirmed'; readonly seat: number }
  | { readonly type: 'avalon.night.stepped'; readonly step: AvalonNightStep }
  | { readonly type: 'avalon.night.completed' }
  | { readonly type: 'avalon.team.proposed'; readonly seats: readonly number[] }
  | { readonly type: 'avalon.team.vote.cast'; readonly seat: number; readonly vote: AvalonBallot }
  | {
      readonly type: 'avalon.vote.settled';
      readonly approved: boolean;
      readonly ballots: Readonly<Record<number, AvalonBallot>>;
      readonly approveCount: number;
      readonly rejectCount: number;
      readonly abstainCount: number;
      readonly nextLeaderSeat: number;
      readonly vetoLimitReached: boolean;
    }
  | { readonly type: 'avalon.quest.played'; readonly seat: number; readonly play: AvalonPlay }
  | {
      readonly type: 'avalon.quest.settled';
      readonly round: AvalonQuestRound;
      readonly successCount: number;
      readonly failCount: number;
      readonly result: 'success' | 'fail';
      readonly historyEntry: AvalonQuestHistoryEntry;
    }
  | { readonly type: 'avalon.lady.checked'; readonly targetSeat: number }
  | {
      readonly type: 'avalon.lady.acknowledged';
      readonly targetSeat: number;
      readonly faction: 'good' | 'evil';
      readonly nextRound: AvalonQuestRound;
      readonly nextRequiredSize: number;
      readonly nextLeaderSeat: number;
    }
  | {
      readonly type: 'avalon.game.ended';
      readonly winner: 'good' | 'evil';
      readonly reason: AvalonEndReason;
      readonly accusedSeat: number | null;
    }
  | { readonly type: 'avalon.game.returnedToLobby' };

/** 终局 growth settlement effect：Worker 据此发 XP 奖励，xpSettled 保证恰好一次。 */
export type AvalonEffect = {
  readonly type: 'avalon.game.completed';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
  };
};

export type AvalonDecision = Decision<AvalonEvent, AvalonEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitAvalon(
  events: readonly AvalonEvent[],
  effects: readonly AvalonEffect[] = [],
): AvalonDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Requires the current host acting outside bot takeover; rejects with the given reason. */
export function requireAvalonHost(
  state: AvalonState,
  context: CommandContext,
  reason: string,
): AvalonDecision | null {
  const actor = resolveHostActorId(context, state.hostUserId);
  return actor.kind === 'rejected' ? reject(reason) : null;
}

export type ResolvedAvalonSeat =
  | { readonly kind: 'resolved'; readonly seat: number }
  | { readonly kind: 'rejected'; readonly reason: string };

function rejectedSeat(reason: string): ResolvedAvalonSeat {
  return { kind: 'rejected', reason };
}

/**
 * Resolves the acting seat: the user's own seat, or a host-takeover bot seat.
 * Takeover is host-only (pictionary pattern); the target must be an implicit bot seat.
 */
export function resolveAvalonSeat(state: AvalonState, context: CommandContext): ResolvedAvalonSeat {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return rejectedSeat(actor.reason);
  if (context.controlledSeat === null) {
    const seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
    return seat === null ? rejectedSeat(REASON_NOT_SEATED) : { kind: 'resolved', seat };
  }
  if (actor.value !== state.hostUserId) return rejectedSeat(REASON_NOT_HOST);
  if (!isAvalonImplicitBotSeat(state, context.controlledSeat))
    return rejectedSeat(REASON_CONTROLLED_SEAT_NOT_BOT);
  return { kind: 'resolved', seat: context.controlledSeat };
}

/** Resolves the acting seat and requires it to hold the assassin role. */
export function resolveAvalonAssassin(
  state: AvalonState,
  context: CommandContext,
  notAssassinReason: string,
): ResolvedAvalonSeat {
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return resolved;
  return state.roles[resolved.seat] === 'assassin' ? resolved : rejectedSeat(notAssassinReason);
}

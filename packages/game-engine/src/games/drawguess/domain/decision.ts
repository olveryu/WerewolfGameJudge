/** DrawGuess decision outcomes and permission gates; no IO. */

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
import { findRosterSeatByUserId, type RosterChange } from '../../../platform/room/seating';
import type { DrawGuessMedia, DrawGuessStroke, DrawGuessWordChoice } from '../state/types';
import { type DrawGuessHumanSeat, type DrawGuessState, isDrawGuessBotSeat } from '../state/types';

export const DRAWGUESS_REASONS = {
  config: '你画我猜配置无效',
  phase: '当前阶段不能执行此操作',
  stale: '对局已推进，请刷新后重试',
  notSeated: '请先入座',
  notDrawer: '只有当前画手可以操作',
  notGuesser: '画手不能提交猜词',
  locked: '本轮已猜中，等待结算',
  emptyChoices: '题目准备中，请稍候',
  invalidWord: '请选择候选词中的题目',
  invalidStroke: '笔画数据无效',
  strokeLimit: '本轮笔画已达上限',
  invalidGuess: '猜词内容无效',
  wordsDealt: '题目已下发',
  reservation: 'PNG 预留无效或已存在',
  full: '请先坐满所有座位，或填充机器人。',
  occupied: '目标人数之外的座位仍有玩家入座，请先让这些玩家离座',
  deadline: '当前阶段尚未到推进时间',
  controlledSeatNotBot: '只能接管机器人席位',
} as const;

export type DrawGuessEvent =
  | {
      readonly type: 'drawguess.seats.changed';
      readonly changes: readonly RosterChange<DrawGuessHumanSeat>[];
    }
  | { readonly type: 'drawguess.config.updated'; readonly config: DrawGuessState['config'] }
  | {
      readonly type: 'drawguess.game.started';
      readonly drawerQueue: readonly number[];
      readonly drawerSeat: number;
    }
  | {
      readonly type: 'drawguess.turn.started';
      readonly turnIndex: number;
      readonly drawerSeat: number;
    }
  | {
      readonly type: 'drawguess.words.dealt';
      readonly turnIndex: number;
      readonly choices: readonly DrawGuessWordChoice[];
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.word.chosen';
      readonly turnIndex: number;
      readonly word: string;
      readonly pinyinInitials: string;
      readonly revealOrder: readonly number[];
      readonly phaseStartAt: number;
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.stroke.added';
      readonly turnIndex: number;
      readonly stroke: DrawGuessStroke;
    }
  | { readonly type: 'drawguess.stroke.undone'; readonly turnIndex: number }
  | { readonly type: 'drawguess.strokes.cleared'; readonly turnIndex: number }
  | {
      readonly type: 'drawguess.guess.submitted';
      readonly turnIndex: number;
      readonly seat: number;
      readonly text: string;
      readonly correct: boolean;
      readonly at: number;
      readonly guesserScore: number;
      readonly drawerScore: number;
    }
  | {
      readonly type: 'drawguess.round.ended';
      readonly turnIndex: number;
      readonly drawerSeat: number;
      readonly word: string;
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.drawing.reserved';
      readonly turnIndex: number;
      readonly submissionId: string;
      readonly entryId: string;
      readonly authorSeat: number;
      readonly reservedAt: number;
    }
  | {
      readonly type: 'drawguess.drawing.committed';
      readonly turnIndex: number;
      readonly pngEntry: DrawGuessMedia;
    }
  | {
      readonly type: 'drawguess.game.ended';
      readonly totalScores: Readonly<Record<number, number>>;
    }
  | { readonly type: 'drawguess.game.returnedToLobby' };

export type DrawGuessEffect =
  | { readonly type: 'drawguess.words.deal'; readonly payload: { readonly turnIndex: number } }
  | {
      readonly type: 'drawguess.game.completed';
      readonly payload: {
        readonly roundId: string;
        readonly completedAt: number;
        readonly participantUserIds: readonly string[];
      };
    };

export type DrawGuessDecision = Decision<DrawGuessEvent, DrawGuessEffect>;

/** Commits domain events and word-dealing effects through the shared runtime. */
export function commitDrawGuess(
  events: readonly DrawGuessEvent[],
  effects: readonly DrawGuessEffect[] = [],
): DrawGuessDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Requires the current host acting outside bot takeover. */
export function requireDrawGuessHost(
  state: DrawGuessState,
  context: CommandContext,
): DrawGuessDecision | null {
  const actor = resolveHostActorId(context, state.hostUserId);
  return actor.kind === 'rejected' ? reject(actor.reason) : null;
}

export type ResolvedDrawGuessSeat =
  | { readonly kind: 'resolved'; readonly seat: number }
  | { readonly kind: 'rejected'; readonly reason: string };

function rejectedSeat(reason: string): ResolvedDrawGuessSeat {
  return { kind: 'rejected', reason };
}

/**
 * Resolves the acting seat: the user's own seat, or a host-takeover bot seat.
 * Takeover is host-only (pictionary pattern); the target must be an implicit bot seat.
 */
export function resolveDrawGuessSeat(
  state: DrawGuessState,
  context: CommandContext,
): ResolvedDrawGuessSeat {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return rejectedSeat(actor.reason);
  if (context.controlledSeat === null) {
    const seat = findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, actor.value);
    return seat === null ? rejectedSeat(REASON_NOT_SEATED) : { kind: 'resolved', seat };
  }
  if (actor.value !== state.hostUserId) return rejectedSeat(REASON_NOT_HOST);
  if (!isDrawGuessBotSeat(state, context.controlledSeat))
    return rejectedSeat(REASON_CONTROLLED_SEAT_NOT_BOT);
  return { kind: 'resolved', seat: context.controlledSeat };
}

/** Resolves the acting seat for guess submission (never the drawer). */
export function resolveDrawGuessGuesser(
  state: DrawGuessState,
  context: CommandContext,
  drawerSeat: number,
): ResolvedDrawGuessSeat {
  const resolved = resolveDrawGuessSeat(state, context);
  if (resolved.kind === 'rejected') return resolved;
  return resolved.seat === drawerSeat ? rejectedSeat(DRAWGUESS_REASONS.notGuesser) : resolved;
}

/** Guards lobby-only commands. */

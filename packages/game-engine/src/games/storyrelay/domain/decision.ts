/** Story Relay decision outcomes and common permission gates; no IO. */

import {
  type CommandContext,
  commit,
  type Decision,
  reject,
  resolveHostActorId,
} from '../../../platform/engine';
import type { SeatChange } from '../../../platform/room/seating';
import type {
  StoryRelayConfig,
  StoryRelayEntry,
  StoryRelayHumanSeat,
  StoryRelayState,
} from '../state/types';

export const STORY_RELAY_REASONS = {
  config: '故事接龙配置无效',
  phase: '当前阶段不能执行此操作',
  task: '故事任务已变化，请刷新后重试',
  submitted: '本棒已收稿',
  text: '请填写 1 至 512 字符的正文',
  full: '请先坐满或补满机器人',
  occupied: '缩小人数前请先移出超出范围的真人',
  deadline: '当前阶段尚未到时',
  manual: '当前为手动回放',
} as const;

export type StoryRelayEvent =
  | {
      readonly type: 'storyrelay.seats.changed';
      readonly changes: readonly SeatChange<StoryRelayHumanSeat>[];
      readonly botSeats: readonly number[];
    }
  | { readonly type: 'storyrelay.config.updated'; readonly config: StoryRelayConfig }
  | {
      readonly type: 'storyrelay.round.started';
      readonly round: Pick<
        StoryRelayState,
        | 'roundId'
        | 'startedAt'
        | 'participants'
        | 'seatOrder'
        | 'stepOffsets'
        | 'chains'
        | 'deadlineAt'
      >;
    }
  | { readonly type: 'storyrelay.task.ready'; readonly seat: number; readonly isReady: boolean }
  | {
      readonly type: 'storyrelay.entries.appended';
      readonly entries: readonly { readonly chainId: string; readonly entry: StoryRelayEntry }[];
    }
  | {
      readonly type: 'storyrelay.phase.changed';
      readonly phase: StoryRelayState['phase'];
      readonly stepIndex: number;
      readonly deadlineAt: number | null;
      readonly gallery: StoryRelayState['gallery'];
    }
  | { readonly type: 'storyrelay.round.completed'; readonly completedAt: number }
  | { readonly type: 'storyrelay.round.aborted'; readonly abortedAt: number }
  | { readonly type: 'storyrelay.game.returnedToLobby' };

export interface StoryRelayEffect {
  readonly type: 'storyrelay.round.completed';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
  };
}
export type StoryRelayDecision = Decision<StoryRelayEvent, StoryRelayEffect>;

/** Commits domain events and durable completion effects through the shared runtime. */
export function commitStoryRelay(
  events: readonly StoryRelayEvent[],
  effects: readonly StoryRelayEffect[] = [],
): StoryRelayDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Requires the current host acting outside bot takeover. */
export function requireStoryRelayHost(
  state: StoryRelayState,
  context: CommandContext,
): StoryRelayDecision | null {
  const actor = resolveHostActorId(context, state.hostUserId);
  return actor.kind === 'rejected' ? reject(actor.reason) : null;
}

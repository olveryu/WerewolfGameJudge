/**
 * 故事接龙进行中阶段的信息条（docs/room-stage-layout-design.md）：第几段、准备 / 收稿名单与倒计时。
 * 纯投影，名单分组取自共享座位数据源（座位状态徽标）。
 */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import {
  countRoomStageRoster,
  groupRoomStageRoster,
  type RoomStageChip,
  type RoomStageHudModel,
  type RoomStageRosterModel,
  type RoomStageTimerModel,
} from '@/features/room/model/RoomStage';

export interface StoryRelayStageHudInput {
  readonly state: StoryRelayState;
  /** Remaining seconds of the phase deadline; null when the phase has none. */
  readonly remainingSeconds: number | null;
  readonly seats: RoomSeatDataSource;
}

/** The roster wording of one phase; the grouping comes from the seat status badges. */
interface StoryRelayRosterCopy {
  readonly chipPrefix: string;
  readonly title: string;
  readonly pendingTitle: string;
  readonly pendingLabel: string;
  readonly doneTitle: string;
}

/** While writing, a seat is done once it marked its passage ready. */
const WRITING_ROSTER: StoryRelayRosterCopy = {
  chipPrefix: '准备',
  title: '准备情况',
  pendingTitle: '还在写',
  pendingLabel: '写作中',
  doneTitle: '已准备',
};

/** While settling, a seat is done once its passage was collected. */
const SETTLING_ROSTER: StoryRelayRosterCopy = {
  chipPrefix: '收稿',
  title: '收稿情况',
  pendingTitle: '待收稿',
  pendingLabel: '待收稿',
  doneTitle: '已收稿',
};

/** Every seat writes at once, so the roster has no acting seat; bots hand in on their own. */
function createRoster(seats: RoomSeatDataSource, copy: StoryRelayRosterCopy): RoomStageRosterModel {
  const { done, total } = countRoomStageRoster(
    groupRoomStageRoster(seats, { actingSeat: null, pendingLabel: copy.pendingLabel }),
  );
  return {
    chipLabel: `${copy.chipPrefix} ${done}/${total}`,
    title: copy.title,
    groupTitles: { acting: copy.pendingLabel, pending: copy.pendingTitle, done: copy.doneTitle },
    actingSeat: null,
    pendingLabel: copy.pendingLabel,
    isUrgent: false,
  };
}

function createWritingTimer(input: StoryRelayStageHudInput): RoomStageTimerModel {
  const totalSeconds = input.state.config.writingDurationSeconds;
  if ((totalSeconds === null) !== (input.remainingSeconds === null)) {
    throw new Error('Story Relay writing deadline disagrees with the configured duration');
  }
  return { label: '写作', remainingSeconds: input.remainingSeconds, totalSeconds };
}

/** A zero-second handoff has nothing to count down. */
function createTransitionTimer(input: StoryRelayStageHudInput): RoomStageTimerModel | null {
  const totalSeconds = input.state.config.transitionDurationSeconds;
  if (input.remainingSeconds === null) {
    throw new Error('Story Relay transition has no remaining seconds');
  }
  if (totalSeconds === 0) return null;
  return { label: '换棒', remainingSeconds: input.remainingSeconds, totalSeconds };
}

/**
 * Builds the information bar for answering, settling and transition; null for the lobby, the
 * gallery and a finished or aborted round, which are not stage content.
 */
export function createStoryRelayStageHud(input: StoryRelayStageHudInput): RoomStageHudModel | null {
  const { state } = input;
  if (state.phase !== 'answering' && state.phase !== 'settling' && state.phase !== 'transition') {
    return null;
  }
  const stepChips: readonly RoomStageChip[] = [
    {
      key: 'step',
      label: `第 ${state.stepIndex + 1}/${state.config.numberOfPlayers} 段`,
      detail: null,
      tone: 'neutral',
    },
  ];
  switch (state.phase) {
    case 'answering':
      return {
        chips: stepChips,
        roster: createRoster(input.seats, WRITING_ROSTER),
        timer: createWritingTimer(input),
        secondaryChips: [],
      };
    case 'settling':
      // Collection waits for the submissions: settling has no deadline.
      return {
        chips: stepChips,
        roster: createRoster(input.seats, SETTLING_ROSTER),
        timer: null,
        secondaryChips: [],
      };
    case 'transition':
      return {
        chips: stepChips,
        roster: null,
        timer: createTransitionTimer(input),
        secondaryChips: [],
      };
  }
}

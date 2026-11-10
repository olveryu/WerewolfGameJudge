/**
 * 你画我猜接龙进行中阶段的信息条（docs/room-stage-layout-design.md）：第几棒、提交名单与倒计时。
 * 纯投影，提交分组取自共享座位数据源（座位状态徽标）。
 */

import {
  getPictionaryAnswerDurationSeconds,
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import {
  countRoomStageRoster,
  groupRoomStageRoster,
  type RoomStageChip,
  type RoomStageHudModel,
  type RoomStageRosterModel,
  type RoomStageTimerModel,
} from '@/features/room/model/RoomStage';

export interface PictionaryStageHudInput {
  readonly state: PictionaryState;
  /** Remaining seconds of the phase deadline; null when the phase has none. */
  readonly remainingSeconds: number | null;
  readonly seats: RoomSeatDataSource;
}

const PENDING_LABEL = '作答中';

/** Every seat answers at once, so the roster has no acting seat; bots hand in on their own. */
function createSubmissionRoster(seats: RoomSeatDataSource): RoomStageRosterModel {
  const { done, total } = countRoomStageRoster(
    groupRoomStageRoster(seats, { actingSeat: null, pendingLabel: PENDING_LABEL }),
  );
  return {
    chipLabel: `已交 ${done}/${total}`,
    title: '提交情况',
    groupTitles: { acting: PENDING_LABEL, pending: '还没交', done: '已交' },
    actingSeat: null,
    pendingLabel: PENDING_LABEL,
    isUrgent: false,
  };
}

function getAnsweringTimerLabel(stepIndex: number): string {
  if (getPictionaryExpectedKind(stepIndex) === 'drawing') return '作画';
  return stepIndex === 0 ? '出题' : '猜词';
}

function createAnsweringTimer(input: PictionaryStageHudInput): RoomStageTimerModel {
  const { state, remainingSeconds } = input;
  const totalSeconds = getPictionaryAnswerDurationSeconds(state, state.stepIndex);
  if ((totalSeconds === null) !== (remainingSeconds === null)) {
    throw new Error('Pictionary answering deadline disagrees with the configured duration');
  }
  return { label: getAnsweringTimerLabel(state.stepIndex), remainingSeconds, totalSeconds };
}

/** A zero-second handoff has nothing to count down. */
function createTransitionTimer(input: PictionaryStageHudInput): RoomStageTimerModel | null {
  const totalSeconds = input.state.config.transitionDurationSeconds;
  if (input.remainingSeconds === null) {
    throw new Error('Pictionary transition has no remaining seconds');
  }
  if (totalSeconds === 0) return null;
  return { label: '换棒', remainingSeconds: input.remainingSeconds, totalSeconds };
}

/**
 * Builds the information bar for answering, transition and settling; null for the lobby, the
 * gallery and a finished or aborted round, which are not stage content.
 */
export function createPictionaryStageHud(input: PictionaryStageHudInput): RoomStageHudModel | null {
  const { state } = input;
  if (state.phase !== 'answering' && state.phase !== 'transition' && state.phase !== 'settling') {
    return null;
  }
  const stepChips: readonly RoomStageChip[] = [
    {
      key: 'step',
      label: `第 ${state.stepIndex + 1}/${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`,
      detail: null,
      tone: 'neutral',
    },
  ];
  switch (state.phase) {
    case 'answering':
      return {
        chips: stepChips,
        roster: createSubmissionRoster(input.seats),
        timer: createAnsweringTimer(input),
        secondaryChips: [],
      };
    case 'transition':
      return {
        chips: stepChips,
        roster: null,
        timer: createTransitionTimer(input),
        secondaryChips: [],
      };
    case 'settling':
      // Collection waits for explicit submissions: settling has no deadline.
      return {
        chips: stepChips,
        roster: createSubmissionRoster(input.seats),
        timer: null,
        secondaryChips: [],
      };
  }
}

/**
 * 你画我猜进行中阶段的信息条（docs/room-stage-layout-design.md）：轮次、题目 / 提示、我的分数、
 * 名单与倒计时。纯投影，座位分组取自共享座位数据源。
 */

import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessState,
  type DrawGuessViewModel,
  getDrawGuessTotalTurns,
  isBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import {
  groupRoomStageRoster,
  type RoomStageChip,
  type RoomStageHudModel,
  type RoomStageRosterModel,
} from '@/features/room/model/RoomStage';

/** A bot drawer nobody controls with fewer seconds left than this marks the roster chip. */
export const DRAWGUESS_BOT_DRAWER_URGENT_SECONDS = 30;

export interface DrawGuessStageHudInput {
  readonly state: DrawGuessState;
  readonly viewModel: DrawGuessViewModel;
  readonly effectiveSeat: number | null;
  /**
   * Remaining seconds of the phase deadline. Null only while the server deals the word choices
   * (word select without a deadline); drawing and round end always have one.
   */
  readonly remainingSeconds: number | null;
  readonly seats: RoomSeatDataSource;
  /** The viewer may take a bot seat over now. */
  readonly canTakeOverBots: boolean;
  readonly controlledSeat: number | null;
}

function createDrawGuessRoster(
  input: DrawGuessStageHudInput,
  drawerSeat: number,
  remainingSeconds: number | null,
): RoomStageRosterModel {
  const isDrawing = input.state.phase.kind === 'drawing';
  const pendingLabel = isDrawing ? '猜词中' : '等待';
  const groups = groupRoomStageRoster(input.seats, { actingSeat: drawerSeat, pendingLabel });
  const guesserCount = groups.pending.length + groups.done.length;
  return {
    chipLabel: isDrawing ? `已猜中 ${groups.done.length}/${guesserCount}` : '名单',
    title: '本轮玩家',
    groupTitles: { acting: '画手', pending: isDrawing ? '还在猜' : '等待', done: '已猜中' },
    actingSeat: drawerSeat,
    pendingLabel,
    isUrgent:
      input.canTakeOverBots &&
      input.controlledSeat === null &&
      isBotSeat(input.state.roster, drawerSeat) &&
      remainingSeconds !== null &&
      remainingSeconds < DRAWGUESS_BOT_DRAWER_URGENT_SECONDS,
  };
}

/** The drawer reads the word; everyone else reads the pinyin-initial hint. */
function createWordChip(viewModel: DrawGuessViewModel): RoomStageChip {
  const label = viewModel.word ?? viewModel.hintText;
  if (label === null) throw new Error('DrawGuess drawing view has neither the word nor a hint');
  return { key: 'word', label, detail: `${viewModel.wordLength} 字`, tone: 'accent' };
}

function createScoreChips(input: DrawGuessStageHudInput): RoomStageChip[] {
  const seat = input.effectiveSeat;
  if (seat === null) return [];
  const total = input.viewModel.scores[seat] ?? 0;
  const turn = input.viewModel.turnScores[seat] ?? 0;
  return [{ key: 'score', label: `我 ${total} 分 · 本轮 +${turn}`, detail: null, tone: 'neutral' }];
}

/** The countdown of a phase whose engine state carries a deadline. */
function requireRemainingSeconds(phaseKind: string, remainingSeconds: number | null): number {
  if (remainingSeconds === null) {
    throw new Error(`DrawGuess ${phaseKind} stage has no remaining seconds`);
  }
  return remainingSeconds;
}

/**
 * Builds the information bar for word select, drawing and round end; null for the lobby and the
 * final ranking, which are not stage content. Word select has no countdown until the server has
 * dealt the choices, so the bar shows no timer then.
 */
export function createDrawGuessStageHud(input: DrawGuessStageHudInput): RoomStageHudModel | null {
  const { state } = input;
  const phase = state.phase;
  if (phase.kind === 'lobby' || phase.kind === 'ended') return null;
  const turnChip: RoomStageChip = {
    key: 'turn',
    label: `${state.turnIndex + 1}/${getDrawGuessTotalTurns(state)} 轮`,
    detail: null,
    tone: 'neutral',
  };
  switch (phase.kind) {
    case 'wordSelect': {
      const remainingSeconds =
        phase.deadlineAt === null
          ? null
          : requireRemainingSeconds(phase.kind, input.remainingSeconds);
      return {
        chips: [turnChip],
        roster: createDrawGuessRoster(input, phase.drawerSeat, remainingSeconds),
        timer:
          remainingSeconds === null
            ? null
            : { label: '选词', remainingSeconds, totalSeconds: DRAWGUESS_WORD_SELECT_SECONDS },
      };
    }
    case 'drawing': {
      const remainingSeconds = requireRemainingSeconds(phase.kind, input.remainingSeconds);
      return {
        chips: [turnChip, createWordChip(input.viewModel), ...createScoreChips(input)],
        roster: createDrawGuessRoster(input, phase.drawerSeat, remainingSeconds),
        timer: {
          label: '作画',
          remainingSeconds,
          totalSeconds: DRAWGUESS_DRAWING_DURATION_SECONDS,
        },
      };
    }
    case 'roundEnd':
      return {
        chips: [turnChip],
        roster: null,
        timer: {
          label: '结算',
          remainingSeconds: requireRemainingSeconds(phase.kind, input.remainingSeconds),
          totalSeconds: DRAWGUESS_ROUND_END_SECONDS,
        },
      };
  }
}

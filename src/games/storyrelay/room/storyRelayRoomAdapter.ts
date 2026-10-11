/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  isBotOccupant,
  isStoryRelayBotSeat,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';

/** Returns a public occupant identity for shared profile controls. */
function getStoryRelayProfileTarget(
  state: StoryRelayState,
  seat: number,
): RoomProfileTarget | null {
  const occupant = state.roster[seat];
  if (occupant != null && !isBotOccupant(occupant))
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isStoryRelayBotSeat(state, seat)
    ? {
        seat,
        userId: `storyrelay-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getBotDisplayName(seat),
      }
    : null;
}

/** Creates the shared seat-board source including public readiness and receipt status. */
export interface StoryRelaySeatSourceInput {
  readonly state: StoryRelayState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface StoryRelaySeatTapInput {
  readonly state: StoryRelayState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project StoryRelay seating into the shared room seat-tap contract. */
export function getStoryRelaySeatTapIntent(input: StoryRelaySeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getStoryRelayProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

export function createStoryRelaySeatDataSource(
  input: StoryRelaySeatSourceInput,
): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('Story Relay seat out of range');
      const occupant = state.roster[seat];
      const target = getStoryRelayProfileTarget(state, seat);
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const player =
        human !== undefined
          ? toRoomSeatPlayer({ kind: 'human', userId: human.userId, ...human.profile })
          : target === null
            ? null
            : {
                kind: 'bot' as const,
                userId: target.userId,
                displayName: target.rosterName,
                isAnonymous: true,
              };
      const task = getStoryRelayTaskForSeat(state, seat);
      const statusBadge: RoomSeatViewModel['statusBadge'] =
        state.phase === 'answering'
          ? {
              label: state.readySeats.includes(seat) ? '已准备' : '写作中',
              tone: state.readySeats.includes(seat) ? 'success' : 'warning',
            }
          : state.phase === 'settling'
            ? {
                label: task?.isSubmitted ? '已收稿' : '待收稿',
                tone: task?.isSubmitted ? 'success' : 'warning',
              }
            : null;
      return {
        seat,
        player,
        isSelf: human?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: null,
        showReadyBadge: false,
        statusBadge: player === null ? null : statusBadge,
        isStatusEmphasized: false,
        showLevel: state.phase === 'lobby',
        decorationsEnabled: state.phase === 'lobby',
        disabledReason:
          player === null && state.phase !== 'lobby' ? '游戏进行中不能入座' : undefined,
      };
    },
  };
}

/** Public status never includes story content or writer identity. */
export function createStoryRelayStatusRibbon(state: StoryRelayState): RoomStatusRibbonModel | null {
  if (state.phase === 'answering' || state.phase === 'transition')
    return {
      kind: 'progress',
      current: state.stepIndex + 1,
      total: state.config.numberOfPlayers,
      label:
        state.phase === 'transition'
          ? '稿件已收齐'
          : state.stepIndex === 0
            ? '写下故事开头'
            : '续写故事',
    };
  const text =
    state.phase === 'lobby'
      ? `等待入座 · ${getStoryRelayOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`
      : state.phase === 'settling'
        ? '正在收稿'
        : state.phase === 'gallery'
          ? '故事揭晓中'
          : state.phase === 'aborted'
            ? '未完成的故事'
            : '本局故事已完成';
  return { kind: 'message', icon: 'guide', text, supportingText: null };
}

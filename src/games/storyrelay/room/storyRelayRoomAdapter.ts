/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';

/** Returns a public occupant identity for shared profile controls. */
export function getStoryRelayProfileTarget(
  state: StoryRelayState,
  seat: number,
): RoomProfileTarget | null {
  const occupant = state.realSeats[seat];
  if (occupant !== undefined)
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return state.botSeats.includes(seat)
    ? {
        seat,
        userId: `storyrelay-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: `机器人${seat + 1}号`,
      }
    : null;
}

/** Creates the shared seat-board source including public readiness and receipt status. */
export function createStoryRelaySeatDataSource(
  state: StoryRelayState,
  revision: number,
  userId: string,
  controlledSeat: number | null,
): RoomSeatDataSource {
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('Story Relay seat out of range');
      const occupant = state.realSeats[seat];
      const target = getStoryRelayProfileTarget(state, seat);
      const player =
        occupant !== undefined
          ? {
              kind: 'human' as const,
              userId: occupant.userId,
              ...occupant.profile,
              seatPetId: occupant.profile.revealEffect,
              isAnonymous: occupant.profile.avatarUrl === undefined,
            }
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
        isSelf: occupant?.userId === userId,
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
export function createStoryRelayStatusRibbon(state: StoryRelayState): RoomStatusRibbonModel {
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
            ? '本局已中止 · 故事未完成'
            : '本局故事已完成';
  return { kind: 'message', icon: 'guide', text, supportingText: null };
}

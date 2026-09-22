/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getUndercoverOccupiedSeatCount,
  type UndercoverCategory,
  type UndercoverRole,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomProfileTarget,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';

const UNDERCOVER_ROLE_NAMES: Readonly<Record<UndercoverRole, string>> = {
  civilian: '平民',
  undercover: '卧底',
  blank: '白板',
};
export const UNDERCOVER_CATEGORY_NAMES: Readonly<Record<UndercoverCategory | 'all', string>> = {
  all: '全部分类',
  food: '吃喝美食',
  dailyLife: '日常生活',
  school: '校园学习',
  work: '职场工作',
  relationships: '人际关系',
  actions: '动作状态',
  entertainment: '文娱休闲',
  sportsAndGames: '运动游戏',
  travel: '出行旅行',
  nature: '自然世界',
};

/** Resolve only public roster identity, never the secret role or word. */
export function getUndercoverProfileTarget(
  state: UndercoverState,
  seat: number,
): RoomProfileTarget | null {
  const human = state.realSeats[seat];
  if (human !== undefined)
    return {
      seat,
      userId: human.userId,
      occupantKind: 'human',
      rosterName: human.profile.displayName,
    };
  return state.botSeats.includes(seat)
    ? {
        seat,
        userId: `undercover-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: `机器人 ${seat + 1}`,
      }
    : null;
}

/** Find a real account's seat independently of local robot control. */
export function getUndercoverUserSeat(state: UndercoverState, userId: string): number | null {
  for (const human of Object.values(state.realSeats))
    if (human !== undefined && human.userId === userId) return human.seat;
  return null;
}

interface UndercoverCapabilitiesInput extends Omit<
  RoomSetupCapabilitiesInput,
  'isSetup' | 'supportsBots' | 'hasOccupiedSeats' | 'isRoomFull'
> {
  readonly state: UndercoverState;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
}

/** Bind shared lobby permissions and game-owned robot authority. */
export function createUndercoverRoomCapabilities(
  input: UndercoverCapabilitiesInput,
): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      ...input,
      isSetup: input.state.phase === 'lobby',
      supportsBots: input.mySeat !== null,
      hasOccupiedSeats: getUndercoverOccupiedSeatCount(input.state) > 0,
      isRoomFull:
        getUndercoverOccupiedSeatCount(input.state) === input.state.config.numberOfPlayers,
    }),
    canViewProfiles: { isAllowed: true, execute: input.openProfile },
    canTakeOverBots:
      input.isHost && (input.state.phase === 'reading' || input.state.phase === 'ongoing')
        ? { isAllowed: true, execute: input.takeOverBot }
        : { isAllowed: false, reason: '当前不能接管机器人' },
  };
}

/** Public seats reveal only eliminated roles until the authoritative winning state arrives. */
export function createUndercoverSeatDataSource(
  state: UndercoverState,
  revision: number,
  myUserId: string,
  controlledSeat: number | null,
  selectedSeat: number | null,
): RoomSeatDataSource {
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat}:${selectedSeat}`,
    getSeat(seat) {
      const target = getUndercoverProfileTarget(state, seat);
      const human = state.realSeats[seat];
      const revelation = state.round?.revelations.find((entry) => entry.seat === seat);
      const role = state.phase === 'ended' ? state.round.roles[seat] : revelation?.role;
      return {
        seat,
        player:
          target === null
            ? null
            : {
                kind: target.occupantKind,
                userId: target.userId,
                displayName: target.rosterName,
                avatarUrl: human?.profile.avatarUrl,
                avatarFrame: human?.profile.avatarFrame,
                seatFlair: human?.profile.seatFlair,
                seatAnimation: human?.profile.seatAnimation,
                nameStyle: human?.profile.nameStyle,
                seatPetId: human?.profile.revealEffect,
                level: human?.profile.level,
                isAnonymous: human?.profile.avatarUrl === undefined,
              },
        isSelf: human?.userId === myUserId,
        highlight:
          controlledSeat === seat ? 'controlled' : selectedSeat === seat ? 'selected' : 'none',
        secondaryLabel:
          role === undefined
            ? null
            : `${revelation === undefined ? '' : '已出局 · '}${UNDERCOVER_ROLE_NAMES[role]}`,
        disabledReason: target === null && state.phase !== 'lobby' ? '本局座位已锁定' : undefined,
        showReadyBadge: state.phase === 'reading' && state.round.confirmedSeats.includes(seat),
        statusBadge: null,
        isStatusEmphasized: revelation !== undefined,
        showLevel: state.phase === 'lobby',
        decorationsEnabled: state.phase === 'lobby',
      };
    },
  };
}

/** Status text contains no hidden identities or words. */
export function createUndercoverStatusRibbon(state: UndercoverState): RoomStatusRibbonModel {
  let text: string;
  switch (state.phase) {
    case 'lobby':
      text = `等待入座 · ${getUndercoverOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`;
      break;
    case 'preparing':
      text = '正在准备词语';
      break;
    case 'preparationFailed':
      text =
        state.failureCode === 'inventoryEmpty'
          ? '暂无可用词语'
          : state.failureCode === 'inventoryExhausted'
            ? '该类别的新词已用完'
            : '词语准备失败';
      break;
    case 'reading':
      text = `确认词卡 · ${state.round.confirmedSeats.length}/${state.config.numberOfPlayers}`;
      break;
    case 'ongoing':
      text = `游戏进行中 · 存活 ${state.config.numberOfPlayers - state.round.revelations.length} 人`;
      break;
    case 'ended':
      text = `${UNDERCOVER_ROLE_NAMES[state.winner]}获胜`;
      break;
    case 'aborted':
      text = '本局已中止';
      break;
  }
  return { kind: 'message', icon: 'guide', text, supportingText: null };
}

/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getUndercoverOccupiedSeatCount,
  isBotOccupant,
  isUndercoverBotSeat,
  type UndercoverCategory,
  type UndercoverRole,
  type UndercoverRoleCounts,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomProfileTarget,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { colors } from '@/theme';

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
  const occupant = state.roster[seat];
  if (occupant != null && !isBotOccupant(occupant))
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isUndercoverBotSeat(state, seat)
    ? {
        seat,
        userId: `undercover-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getBotDisplayName(seat),
      }
    : null;
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
      supportsBots: true,
      hasOccupiedSeats: getUndercoverOccupiedSeatCount(input.state) > 0,
      isRoomFull:
        getUndercoverOccupiedSeatCount(input.state) === input.state.config.numberOfPlayers,
    }),
    canViewProfiles: { isAllowed: true, execute: input.openProfile },
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
  };
}

/** Public seats reveal only eliminated roles until the authoritative winning state arrives. */
export interface UndercoverSeatSourceInput {
  readonly state: UndercoverState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
  readonly selectedSeat: number | null;
  readonly isSelecting: boolean;
}

export function createUndercoverSeatDataSource(
  input: UndercoverSeatSourceInput,
): RoomSeatDataSource {
  const { state, revision, myUserId, controlledSeat, selectedSeat, isSelecting } = input;
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat}:${selectedSeat}:${isSelecting}`,
    getSeat(seat) {
      const target = getUndercoverProfileTarget(state, seat);
      const occupant = state.roster[seat];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const revelation = state.round?.revelations.find((entry) => entry.seat === seat);
      const role = state.phase === 'ended' ? state.round.roles[seat] : revelation?.role;
      return {
        seat,
        player:
          target === null
            ? null
            : toRoomSeatPlayer({
                kind: target.occupantKind,
                userId: target.userId,
                ...human?.profile,
                displayName: target.rosterName,
              }),
        isSelf: human?.userId === myUserId,
        highlight:
          selectedSeat === seat ? 'selected' : controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel:
          role === undefined
            ? null
            : `${revelation === undefined ? '' : '已出局 · '}${UNDERCOVER_ROLE_NAMES[role]}`,
        disabledReason:
          isSelecting && revelation !== undefined
            ? '该玩家已出局'
            : target === null && state.phase !== 'lobby'
              ? '本局座位已锁定'
              : undefined,
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
export function createUndercoverStatusRibbon(state: UndercoverState): RoomStatusRibbonModel | null {
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
  return {
    kind: 'message',
    icon: state.phase === 'ongoing' ? 'speaking' : 'guide',
    text,
    supportingText:
      state.phase === 'ongoing'
        ? `首轮从 ${state.round.speakingStartSeat + 1} 号开始发言（随机）`
        : null,
  };
}

export interface UndercoverBoardInfoSectionsInput {
  readonly roleCounts: UndercoverRoleCounts;
  readonly hasBlank: boolean;
}

/** 卧底板子信息分组：卧底 / 平民，白板局时多一组白板。 */
export function createUndercoverBoardInfoSections(
  input: UndercoverBoardInfoSectionsInput,
): readonly BoardInfoSection[] {
  const { roleCounts } = input;
  const sections: BoardInfoSection[] = [
    {
      title: '卧底',
      items: [{ roleId: 'undercover', displayName: '卧底', count: roleCounts.undercover }],
      color: colors.wolf,
    },
    {
      title: '平民',
      items: [{ roleId: 'civilian', displayName: '平民', count: roleCounts.civilian }],
      color: colors.villager,
    },
  ];
  if (input.hasBlank) {
    sections.push({
      title: '白板',
      items: [{ roleId: 'blank', displayName: '白板', count: roleCounts.blank }],
      color: colors.textMuted,
    });
  }
  return sections;
}

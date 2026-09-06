/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryBotDisplayName,
  getPictionaryBotUserId,
  getPictionaryOccupiedSeatCount,
  getPictionaryTaskForSeat,
  isPictionaryImplicitBotSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import type { RoomBottomInfoModel } from '@/features/room/model/RoomBottomActions';
import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';

export const PICTIONARY_DISPLAY_NAME = '你画我猜接龙';

const denied = <TArgs extends readonly unknown[], TResult>(
  reason: string,
): RoomCapability<TArgs, TResult> => ({ isAllowed: false, reason });

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

interface PictionaryCapabilitiesInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly leaveSeat: () => void;
  readonly kickSeat: (seat: number) => void;
  readonly clearSeats: () => void;
  readonly fillBots: () => void;
  readonly configureGame: () => void;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
  readonly shareRoom: () => void;
}

export function createPictionaryRoomCapabilities(
  input: PictionaryCapabilitiesInput,
): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup: isLobby,
    isHost: input.isHost,
    supportsBots: true,
    mySeat: input.mySeat,
    hasOccupiedSeats: getPictionaryOccupiedSeatCount(input.state) > 0,
    isRoomFull: isPictionaryRoomFull(input.state),
    requestTakeSeat: input.requestTakeSeat,
    requestMoveSeat: input.requestMoveSeat,
    leaveSeat: input.leaveSeat,
    kickSeat: input.kickSeat,
    clearSeats: input.clearSeats,
    fillBots: input.fillBots,
    configureGame: input.configureGame,
    shareRoom: input.shareRoom,
  });
  return {
    ...setupCapabilities,
    canViewProfiles: isLobby ? allowed(input.openProfile) : denied('游戏进行中不能查看玩家资料'),
    canTakeOverBots:
      input.isHost && (input.state.phase === 'answering' || input.state.phase === 'settling')
        ? allowed(input.takeOverBot)
        : denied('当前阶段不能接管机器人'),
  };
}

export function getPictionaryProfileTarget(
  state: PictionaryState,
  seat: number,
): RoomProfileTarget | null {
  const occupant = state.realSeats[seat];
  if (occupant !== undefined) {
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  }
  if (!isPictionaryImplicitBotSeat(state, seat)) return null;
  return {
    seat,
    userId: getPictionaryBotUserId(state.roomCode, seat),
    occupantKind: 'bot',
    rosterName: getPictionaryBotDisplayName(seat),
  };
}

interface PictionarySeatSourceInput {
  readonly state: PictionaryState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
}

function getPictionarySeatStatus(
  state: PictionaryState,
  seat: number,
): RoomSeatViewModel['statusBadge'] {
  if (state.phase !== 'answering' && state.phase !== 'settling') return null;
  const task = getPictionaryTaskForSeat(state, seat);
  if (task === null) return null;
  if (task.chain.entries.length > state.stepIndex) {
    return { label: '已提交', tone: 'success' };
  }
  if (state.reservations.some((reservation) => reservation.authorSeat === seat)) {
    return { label: '上传中', tone: 'info' };
  }
  return { label: '作答中', tone: 'warning' };
}

export function createPictionarySeatDataSource(
  input: PictionarySeatSourceInput,
): RoomSeatDataSource {
  return {
    count: input.state.config.numberOfPlayers,
    revision: `${input.revision}:${input.controlledSeat ?? 'self'}`,
    getSeat(index): RoomSeatViewModel {
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= input.state.config.numberOfPlayers
      ) {
        throw new Error(`Pictionary seat source index is out of range: ${index}`);
      }
      const occupant = input.state.realSeats[index];
      const isBot = occupant === undefined && isPictionaryImplicitBotSeat(input.state, index);
      const player =
        occupant !== undefined
          ? {
              kind: 'human' as const,
              userId: occupant.userId,
              displayName: occupant.profile.displayName,
              avatarUrl: occupant.profile.avatarUrl,
              avatarFrame: occupant.profile.avatarFrame,
              seatFlair: occupant.profile.seatFlair,
              seatAnimation: occupant.profile.seatAnimation,
              nameStyle: occupant.profile.nameStyle,
              seatPetId: occupant.profile.revealEffect,
              level: occupant.profile.level,
              isAnonymous: occupant.profile.avatarUrl === undefined,
            }
          : isBot
            ? {
                kind: 'bot' as const,
                userId: getPictionaryBotUserId(input.state.roomCode, index),
                displayName: getPictionaryBotDisplayName(index),
                isAnonymous: true,
              }
            : null;
      return {
        seat: index,
        player,
        isSelf: occupant?.userId === input.myUserId,
        highlight: input.controlledSeat === index ? 'controlled' : 'none',
        secondaryLabel: null,
        disabledReason:
          player === null && input.state.phase !== 'lobby' ? '游戏进行中不能入座' : undefined,
        showReadyBadge: false,
        statusBadge: player === null ? null : getPictionarySeatStatus(input.state, index),
        isStatusEmphasized: false,
        showLevel: input.state.phase === 'lobby',
        decorationsEnabled: input.state.phase === 'lobby',
      };
    },
  };
}

export function getPictionarySeatTapIntent(input: {
  readonly state: PictionaryState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getPictionaryProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

export function createPictionaryStatusRibbon(state: PictionaryState): RoomStatusRibbonModel {
  switch (state.phase) {
    case 'lobby':
      return {
        kind: 'message',
        icon: 'guide',
        text: `等待入座 · ${getPictionaryOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
        supportingText: null,
      };
    case 'answering':
      return {
        kind: 'progress',
        current: state.stepIndex + 1,
        total: state.config.numberOfPlayers,
        label: state.stepIndex === 0 ? '自由作画中' : '接龙作答中',
      };
    case 'settling':
      return { kind: 'message', icon: 'guide', text: '正在接收画作', supportingText: null };
    case 'transition':
      return {
        kind: 'progress',
        current: state.stepIndex + 1,
        total: state.config.numberOfPlayers,
        label: '准备下一棒',
      };
    case 'gallery': {
      if (state.gallery === null) {
        throw new Error('[FAIL-FAST] Pictionary gallery phase requires gallery state');
      }
      return {
        kind: 'progress',
        current:
          state.gallery.chainIndex * state.config.numberOfPlayers + state.gallery.entryIndex + 1,
        total: state.config.numberOfPlayers ** 2,
        label: '接龙揭晓中',
      };
    }
    case 'ended':
      return { kind: 'message', icon: 'guide', text: '本局接龙已揭晓', supportingText: null };
  }
}

export function createPictionaryBottomActions(
  state: PictionaryState,
  isHost: boolean,
  mySeat: number | null,
): RoomBottomInfoModel {
  const message =
    state.phase !== 'lobby'
      ? null
      : mySeat === null
        ? '选择一个空位入座'
        : isHost
          ? null
          : '等待房主开始游戏';
  return { kind: 'info', message, actions: [] };
}

interface PictionaryLobbyHostManagementInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  readonly startRound: () => void;
  readonly onStartDisabled: () => void;
}

function hostAction(
  key: string,
  label: string,
  icon: RoomHostManagementAction['icon'],
  variant: RoomHostManagementAction['variant'],
  onPress: () => void,
): RoomHostManagementAction {
  return { key, label, icon, variant, isEnabled: true, onPress };
}

export function createPictionaryLobbyHostManagement(
  input: PictionaryLobbyHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost || input.state.phase !== 'lobby') return null;
  const startAction: RoomHostManagementAction = input.isCommandSubmitting
    ? {
        key: 'start-round',
        label: '开始游戏',
        icon: 'play-outline',
        variant: 'primary',
        isLoading: true,
        isEnabled: false,
        testID: TESTIDS.pictionaryStartRoundButton,
        disabledReason: null,
        onDisabledPress: null,
      }
    : isPictionaryRoomFull(input.state)
      ? {
          ...hostAction('start-round', '开始游戏', 'play-outline', 'primary', input.startRound),
          testID: TESTIDS.pictionaryStartRoundButton,
        }
      : {
          key: 'start-round',
          label: '开始游戏',
          icon: 'play-outline',
          variant: 'primary',
          isEnabled: false,
          testID: TESTIDS.pictionaryStartRoundButton,
          disabledReason: '座位尚未坐满',
          onDisabledPress: input.onStartDisabled,
        };
  const roomActions: RoomHostManagementAction[] = [];
  if (input.capabilities.canConfigureGame.isAllowed) {
    roomActions.push(
      hostAction(
        'configure-game',
        '房间设置',
        'options-outline',
        'secondary',
        input.capabilities.canConfigureGame.execute,
      ),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    roomActions.push({
      ...hostAction(
        'fill-bots',
        '填充机器人',
        'people-outline',
        'secondary',
        input.capabilities.canFillBots.execute,
      ),
      testID: TESTIDS.roomFillBotsButton,
    });
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    roomActions.push(
      hostAction(
        'clear-seats',
        '清空座位',
        'trash-outline',
        'danger',
        input.capabilities.canClearSeats.execute,
      ),
    );
  }
  const sections: RoomHostManagementSection[] = [
    { key: 'current-flow', title: '当前流程', actions: [startAction] },
  ];
  if (roomActions.length > 0) {
    sections.push({ key: 'room-management', title: '房间管理', actions: roomActions });
  }
  return {
    preview: '下一步：开始游戏',
    status: `等待入座 · ${getPictionaryOccupiedSeatCount(input.state)}/${input.state.config.numberOfPlayers}`,
    sections,
  };
}

/** FibKing-owned derivation of game-neutral RoomShell models. */

import {
  type FibRole,
  type FibState,
  getFibBotDisplayName,
  getFibBotUserId,
  getFibOccupiedSeatCount,
  getFibRole,
  isFibImplicitBotSeat,
  isFibRoomFull,
} from '@game-judge/game-engine/games/fibking/public';

import type {
  RoomBottomButton,
  RoomBottomStackModel,
} from '@/features/room/model/RoomBottomActions';
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

export const FIB_DISPLAY_NAME = '瞎掰王';

const FIB_ROLE_NAMES: Readonly<Record<FibRole, string>> = {
  guesser: '大聪明',
  honest: '老实人',
  fibber: '瞎掰王',
};

const denied = <TArgs extends readonly unknown[], TResult>(
  reason: string,
): RoomCapability<TArgs, TResult> => ({ isAllowed: false, reason });

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

interface FibCapabilitiesInput {
  readonly state: FibState;
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

export function createFibRoomCapabilities(input: FibCapabilitiesInput): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  const occupiedCount = getFibOccupiedSeatCount(input.state);
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup: isLobby,
    isHost: input.isHost,
    mySeat: input.mySeat,
    hasOccupiedSeats: occupiedCount > 0,
    isRoomFull: isFibRoomFull(input.state),
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
    canViewProfiles: allowed(input.openProfile),
    canTakeOverBots:
      input.isHost && input.state.phase === 'ongoing'
        ? allowed(input.takeOverBot)
        : denied('当前阶段不能接管机器人'),
  };
}

export function getFibProfileTarget(state: FibState, seat: number): RoomProfileTarget | null {
  const human = state.realSeats[seat];
  if (human !== undefined) {
    return {
      seat,
      userId: human.userId,
      occupantKind: 'human',
      rosterName: human.profile.displayName,
    };
  }
  if (!isFibImplicitBotSeat(state, seat)) return null;
  return {
    seat,
    userId: getFibBotUserId(state.roomCode, seat),
    occupantKind: 'bot',
    rosterName: getFibBotDisplayName(seat),
  };
}

interface FibSeatTapInput {
  readonly state: FibState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project Fib sparse seating into the shared room seat-tap contract. */
export function getFibSeatTapIntent(input: FibSeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getFibProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

function getSeatRoleLabel(state: FibState, seat: number): string | null {
  if (
    state.phase === 'lobby' ||
    state.phase === 'preparing' ||
    state.phase === 'preparationFailed'
  ) {
    return null;
  }
  const role = getFibRole(state.round.roles, seat);
  if (state.phase === 'ongoing' && role !== 'guesser') return null;
  return FIB_ROLE_NAMES[role];
}

interface FibSeatSourceInput {
  readonly state: FibState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
}

export function createFibSeatDataSource(input: FibSeatSourceInput): RoomSeatDataSource {
  return {
    count: input.state.numberOfPlayers,
    revision: `${input.revision}:${input.controlledSeat ?? 'self'}`,
    getSeat(index): RoomSeatViewModel {
      if (!Number.isSafeInteger(index) || index < 0 || index >= input.state.numberOfPlayers) {
        throw new Error(`Fib seat source index is out of range: ${index}`);
      }

      const human = input.state.realSeats[index];
      const isBot = human === undefined && isFibImplicitBotSeat(input.state, index);
      const player =
        human !== undefined
          ? {
              kind: 'human' as const,
              userId: human.userId,
              displayName: human.profile.displayName,
              avatarUrl: human.profile.avatarUrl,
              avatarFrame: human.profile.avatarFrame,
              seatFlair: human.profile.seatFlair,
              seatAnimation: human.profile.seatAnimation,
              nameStyle: human.profile.nameStyle,
              seatPetId: human.profile.revealEffect,
              level: human.profile.level,
              isAnonymous: human.profile.avatarUrl === undefined,
            }
          : isBot
            ? {
                kind: 'bot' as const,
                userId: getFibBotUserId(input.state.roomCode, index),
                displayName: getFibBotDisplayName(index),
                isAnonymous: true,
              }
            : null;

      return {
        seat: index,
        player,
        isSelf: human?.userId === input.myUserId,
        highlight: input.controlledSeat === index ? 'controlled' : 'none',
        secondaryLabel: player === null ? null : getSeatRoleLabel(input.state, index),
        disabledReason:
          player === null && input.state.phase !== 'lobby' ? '当前阶段座位已锁定' : undefined,
        showReadyBadge: false,
        statusBadge: null,
        isStatusEmphasized: false,
        showLevel: input.state.phase === 'lobby',
        decorationsEnabled: input.state.phase === 'lobby',
      };
    },
  };
}

export function createFibStatusRibbon(state: FibState): RoomStatusRibbonModel {
  switch (state.phase) {
    case 'lobby':
      return {
        kind: 'message',
        icon: 'guide',
        text: `等待入座 · ${getFibOccupiedSeatCount(state)}/${state.numberOfPlayers}`,
        supportingText: null,
      };
    case 'preparing':
      return {
        kind: 'message',
        icon: 'guide',
        text: '正在准备本轮词语',
        supportingText: null,
      };
    case 'preparationFailed':
      return {
        kind: 'message',
        icon: 'guide',
        text: '词语准备失败',
        supportingText: '暂无可用词语，请重新准备',
      };
    case 'ongoing':
      return {
        kind: 'message',
        icon: 'speaking',
        text: '描述进行中',
        supportingText: '大聪明根据大家的描述猜词',
      };
    case 'ended':
      return {
        kind: 'message',
        icon: 'guide',
        text: '本轮答案已公布',
        supportingText: null,
      };
  }
}

interface FibHostManagementInput {
  readonly state: FibState;
  readonly isHost: boolean;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  readonly startRound: () => void;
  readonly cancelPreparing: () => void;
  readonly revealRound: () => void;
  readonly endGame: () => void;
  readonly onStartDisabled: () => void;
}

interface FibHostActionDescriptor {
  readonly key: string;
  readonly label: string;
  readonly icon: RoomHostManagementAction['icon'];
  readonly variant: RoomHostManagementAction['variant'];
  readonly testID?: string;
}

function enabledHostAction(
  descriptor: FibHostActionDescriptor,
  onPress: () => void,
): RoomHostManagementAction {
  return { ...descriptor, isEnabled: true, onPress };
}

function commandHostAction(
  input: FibHostManagementInput,
  descriptor: FibHostActionDescriptor,
  onPress: () => void,
): RoomHostManagementAction {
  return input.isCommandSubmitting
    ? {
        ...descriptor,
        isLoading: true,
        isEnabled: false,
        disabledReason: null,
        onDisabledPress: null,
      }
    : enabledHostAction(descriptor, onPress);
}

function createFibCurrentFlowActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  switch (input.state.phase) {
    case 'lobby': {
      const descriptor: FibHostActionDescriptor = {
        key: 'start-round',
        label: '开始本轮',
        icon: 'play-outline',
        variant: 'primary',
        testID: TESTIDS.fibStartRoundButton,
      };
      if (input.isCommandSubmitting) {
        return [commandHostAction(input, descriptor, input.startRound)];
      }
      return [
        isFibRoomFull(input.state)
          ? enabledHostAction(descriptor, input.startRound)
          : {
              ...descriptor,
              isEnabled: false,
              disabledReason: '座位尚未坐满',
              onDisabledPress: input.onStartDisabled,
            },
      ];
    }
    case 'preparing':
      return [
        commandHostAction(
          input,
          {
            key: 'cancel-preparing',
            label: '取消准备',
            icon: 'close-circle-outline',
            variant: 'secondary',
            testID: TESTIDS.fibCancelPreparingButton,
          },
          input.cancelPreparing,
        ),
      ];
    case 'preparationFailed':
      return [
        commandHostAction(
          input,
          {
            key: 'retry-preparation',
            label: '重新准备',
            icon: 'refresh-outline',
            variant: 'primary',
            testID: TESTIDS.fibRetryPreparationButton,
          },
          input.startRound,
        ),
        commandHostAction(
          input,
          {
            key: 'return-lobby',
            label: '返回大厅',
            icon: 'return-down-back-outline',
            variant: 'secondary',
            testID: TESTIDS.fibReturnLobbyButton,
          },
          input.cancelPreparing,
        ),
      ];
    case 'ongoing':
      return [
        commandHostAction(
          input,
          {
            key: 'reveal-round',
            label: '公布答案',
            icon: 'eye-outline',
            variant: 'primary',
            testID: TESTIDS.fibRevealRoundButton,
          },
          input.revealRound,
        ),
      ];
    case 'ended':
      return [
        commandHostAction(
          input,
          {
            key: 'next-round',
            label: '下一轮',
            icon: 'play-forward-outline',
            variant: 'primary',
            testID: TESTIDS.fibNextRoundButton,
          },
          input.startRound,
        ),
      ];
  }
}

function createFibRoomManagementActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  const actions: RoomHostManagementAction[] = [];
  if (input.capabilities.canConfigureGame.isAllowed) {
    actions.push(
      enabledHostAction(
        {
          key: 'configure-game',
          label: '房间设置',
          icon: 'options-outline',
          variant: 'secondary',
          testID: TESTIDS.fibConfigureButton,
        },
        input.capabilities.canConfigureGame.execute,
      ),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    actions.push(
      enabledHostAction(
        {
          key: 'fill-bots',
          label: '填充机器人',
          icon: 'people-outline',
          variant: 'secondary',
          testID: TESTIDS.roomFillBotsButton,
        },
        input.capabilities.canFillBots.execute,
      ),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    actions.push(
      enabledHostAction(
        {
          key: 'clear-seats',
          label: '清空座位',
          icon: 'trash-outline',
          variant: 'danger',
          testID: TESTIDS.roomClearSeatsButton,
        },
        input.capabilities.canClearSeats.execute,
      ),
    );
  }
  return actions;
}

function createFibDangerActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  if (input.state.phase !== 'ended') return [];
  return [
    commandHostAction(
      input,
      {
        key: 'end-game',
        label: '结束游戏',
        icon: 'stop-circle-outline',
        variant: 'danger',
        testID: TESTIDS.fibEndGameButton,
      },
      input.endGame,
    ),
  ];
}

function createFibHostSection(
  key: string,
  title: string,
  actions: readonly RoomHostManagementAction[],
): RoomHostManagementSection | null {
  return actions.length === 0 ? null : { key, title, actions };
}

function getFibHostPreview(state: FibState): string {
  switch (state.phase) {
    case 'lobby':
      return '下一步：开始本轮';
    case 'preparing':
      return '正在准备，可取消';
    case 'preparationFailed':
      return '待处理：重新准备';
    case 'ongoing':
      return '待处理：公布答案';
    case 'ended':
      return '下一步：下一轮';
  }
}

function getFibHostStatus(state: FibState): string {
  switch (state.phase) {
    case 'lobby':
      return `等待入座 · ${getFibOccupiedSeatCount(state)}/${state.numberOfPlayers}`;
    case 'preparing':
      return '正在准备本轮词语';
    case 'preparationFailed':
      return '词语准备失败';
    case 'ongoing':
      return '描述进行中';
    case 'ended':
      return '本轮答案已公布';
  }
}

/** Build the complete FibKing Host-only command surface from current room facts. */
export function createFibHostManagement(
  input: FibHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
  const sections = [
    createFibHostSection('current-flow', '当前流程', createFibCurrentFlowActions(input)),
    createFibHostSection('room-management', '房间管理', createFibRoomManagementActions(input)),
    createFibHostSection('danger', '危险操作', createFibDangerActions(input)),
  ].filter((section): section is RoomHostManagementSection => section !== null);

  if (sections.length === 0) {
    throw new Error('FibKing Host management must expose at least one action');
  }
  return {
    preview: getFibHostPreview(input.state),
    status: getFibHostStatus(input.state),
    sections,
  };
}

function enabledButton(
  key: string,
  label: string,
  variant: RoomBottomButton['variant'],
  testID: string,
  onPress: () => void,
): RoomBottomButton {
  return {
    key,
    label,
    variant,
    size: variant === 'primary' ? 'lg' : 'md',
    testID,
    isEnabled: true,
    onPress,
  };
}

interface FibBottomActionsInput {
  readonly state: FibState;
  readonly isHost: boolean;
  readonly viewerSeat: number | null;
  readonly openIdentity: () => void;
}

export function createFibBottomActions(input: FibBottomActionsInput): RoomBottomStackModel {
  const primary: RoomBottomButton[] = [];
  const secondary: RoomBottomButton[] = [];
  const ghost: RoomBottomButton[] = [];

  switch (input.state.phase) {
    case 'lobby':
    case 'preparing':
    case 'preparationFailed':
      break;
    case 'ongoing':
      secondary.push(
        enabledButton(
          'view-identity',
          input.viewerSeat === null ? '查看题目' : '查看身份',
          'secondary',
          TESTIDS.fibViewIdentityButton,
          input.openIdentity,
        ),
      );
      break;
    case 'ended':
      secondary.push(
        enabledButton(
          'view-result',
          '查看结果',
          'secondary',
          TESTIDS.fibViewResultButton,
          input.openIdentity,
        ),
      );
      break;
  }

  return {
    kind: 'stacked',
    message: input.isHost ? null : getPlayerMessage(input.state),
    layout: { primary, secondary, ghost },
  };
}

function getPlayerMessage(state: FibState): string | null {
  switch (state.phase) {
    case 'lobby':
      return '等待房主开始本轮';
    case 'preparing':
      return '房主正在准备本轮';
    case 'preparationFailed':
      return '词语准备失败，等待房主重新准备';
    case 'ongoing':
    case 'ended':
      return null;
  }
}

export function getFibRoleName(role: FibRole): string {
  return FIB_ROLE_NAMES[role];
}

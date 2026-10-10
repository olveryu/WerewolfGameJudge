/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryBotDisplayName,
  getPictionaryBotUserId,
  getPictionaryOccupiedSeatCount,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  isBotOccupant,
  isPictionaryBotSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildRoomConfigAction,
} from '@/features/room/model/hostManagementActions';
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
    canTakeOverBots: input.isHost ? allowed(input.takeOverBot) : denied('只有房主可以接管机器人'),
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
      const occupant = input.state.roster[index];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const isBot = isPictionaryBotSeat(input.state, index);
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
                userId: getPictionaryBotUserId(input.state.roomCode, index),
                displayName: getPictionaryBotDisplayName(index),
                isAnonymous: true,
              }
            : null;
      return {
        seat: index,
        player,
        isSelf: human?.userId === input.myUserId,
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
  const occupant = input.state.roster[input.seat];
  const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
  const target: RoomProfileTarget | null =
    human !== undefined
      ? {
          seat: input.seat,
          userId: human.userId,
          occupantKind: 'human',
          rosterName: human.profile.displayName,
        }
      : isPictionaryBotSeat(input.state, input.seat)
        ? {
            seat: input.seat,
            userId: getPictionaryBotUserId(input.state.roomCode, input.seat),
            occupantKind: 'bot',
            rosterName: getPictionaryBotDisplayName(input.seat),
          }
        : null;
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target,
    disabledReason: input.disabledReason,
  });
}

export function createPictionaryStatusRibbon(state: PictionaryState): RoomStatusRibbonModel {
  const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
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
        total: relayStepCount,
        label: state.stepIndex === 0 ? '全员出题中' : '接龙作答中',
      };
    case 'settling':
      return { kind: 'message', icon: 'guide', text: '正在收取最终内容', supportingText: null };
    case 'transition':
      return {
        kind: 'progress',
        current: state.stepIndex + 1,
        total: relayStepCount,
        label: '准备下一棒',
      };
    case 'gallery': {
      if (state.gallery === null) {
        throw new Error('[FAIL-FAST] Pictionary gallery phase requires gallery state');
      }
      return {
        kind: 'progress',
        current: state.gallery.chainIndex * (state.stepIndex + 1) + state.gallery.entryIndex + 1,
        total: state.config.numberOfPlayers * (state.stepIndex + 1),
        label: '接龙揭晓中',
      };
    }
    case 'ended':
      return { kind: 'message', icon: 'guide', text: '本局接龙已揭晓', supportingText: null };
    case 'aborted':
      return {
        kind: 'message',
        icon: 'guide',
        text: '本局已中止，作品未完成',
        supportingText: null,
      };
  }
}

export function createPictionaryBottomActions(
  state: PictionaryState,
  isHost: boolean,
  mySeat: number | null,
): RoomBottomInfoModel {
  const message =
    state.phase !== 'lobby' || mySeat === null ? null : isHost ? null : '等待房主开始游戏';
  return { kind: 'info', message, actions: [] };
}

interface PictionaryHostManagementInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  readonly startRound: () => void;
  readonly nextRound: () => void;
  readonly returnToLobby: () => void;
  readonly finishPhase: () => void;
  readonly abortRound: () => void;
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

export function createPictionaryHostManagement(
  input: PictionaryHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
  if (input.state.phase === 'ended' || input.state.phase === 'aborted') {
    const actions: RoomHostManagementAction[] = [];
    if (input.state.phase === 'ended')
      actions.push(
        hostAction('next-round', '再来一轮', 'play-forward-outline', 'primary', input.nextRound),
      );
    actions.push(
      hostAction(
        'return-lobby',
        '返回大厅',
        'return-down-back-outline',
        'secondary',
        input.returnToLobby,
      ),
    );
    return {
      preview: '本轮已结束',
      status: null,
      sections: [{ key: 'current-flow', title: '当前流程', actions }],
    };
  }
  if (input.state.phase !== 'lobby') {
    const canAbort =
      ['answering', 'settling', 'transition'].includes(input.state.phase) &&
      !(
        input.state.phase === 'transition' &&
        input.state.stepIndex === input.state.config.numberOfPlayers - 1
      );
    if (!canAbort) return null;
    const sections: RoomHostManagementSection[] = [];
    if (input.state.phase === 'answering')
      sections.push({
        key: 'current-flow',
        title: '当前流程',
        actions: [
          hostAction(
            'finish-phase',
            '结束本棒',
            'stop-circle-outline',
            'secondary',
            input.finishPhase,
          ),
        ],
      });
    sections.push({
      key: 'danger',
      title: '危险操作',
      actions: [
        hostAction('abort-round', '中止本局', 'close-circle-outline', 'danger', input.abortRound),
      ],
    });
    return { preview: '管理本局', status: null, sections };
  }
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
      buildRoomConfigAction({
        onPress: input.capabilities.canConfigureGame.execute,
      }),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    roomActions.push(
      buildFillBotsAction({
        onPress: input.capabilities.canFillBots.execute,
      }),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    roomActions.push(
      buildClearSeatsAction({
        onPress: input.capabilities.canClearSeats.execute,
      }),
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

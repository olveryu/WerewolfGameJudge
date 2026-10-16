/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryBotUserId,
  getPictionaryOccupiedSeatCount,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import {
  buildRoomHeaderModel,
  type RoomHeaderGachaStatus,
} from '@/features/room/model/buildRoomHeaderModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import type { RoomBottomInfoModel } from '@/features/room/model/RoomBottomActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type {
  RoomConnectionViewModel,
  RoomControlledSeatModel,
  RoomShellModel,
} from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

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
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
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
  const { state } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision: input.revision,
    roster: state.roster,
    viewerUserId: input.myUserId,
    controlledSeat: input.controlledSeat,
    isLobby: state.phase === 'lobby',
    botUserId: (seat) => getPictionaryBotUserId(state.roomCode, seat),
    outOfRangeError: (seat) => `Pictionary seat source index is out of range: ${seat}`,
    lockedSeatReason: '游戏进行中不能入座',
    resolveStatusBadge: (seat, player) =>
      player === null ? null : getPictionarySeatStatus(state, seat),
  });
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
    target: getRoomProfileTarget(
      input.state.roster,
      input.seat,
      (botSeat) => getPictionaryBotUserId(input.state.roomCode, botSeat),
      getBotDisplayName,
    ),
    disabledReason: input.disabledReason,
  });
}

/**
 * The stepped relay phases feed the bottom panel's slim progress row;
 * every other phase has no step progress.
 */
export function derivePictionaryBottomProgress(state: PictionaryState): NightStepProgress | null {
  const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
  switch (state.phase) {
    case 'answering':
      return {
        current: state.stepIndex + 1,
        total: relayStepCount,
        label: state.stepIndex === 0 ? '全员出题中' : '接龙作答中',
      };
    case 'transition':
      return { current: state.stepIndex + 1, total: relayStepCount, label: '准备下一棒' };
    case 'gallery': {
      if (state.gallery === null) {
        throw new Error('[FAIL-FAST] Pictionary gallery phase requires gallery state');
      }
      return {
        current: state.gallery.chainIndex * (state.stepIndex + 1) + state.gallery.entryIndex + 1,
        total: state.config.numberOfPlayers * (state.stepIndex + 1),
        label: '接龙揭晓中',
      };
    }
    default:
      return null;
  }
}

function createPictionaryBottomActions(
  state: PictionaryState,
  isHost: boolean,
  mySeat: number | null,
): RoomBottomInfoModel {
  const message = buildLobbyHostStartMessage({
    isLobby: state.phase === 'lobby',
    isHost,
    mySeat,
  });
  return { kind: 'info', message, progress: derivePictionaryBottomProgress(state), actions: [] };
}

interface PictionaryHostManagementInput {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots' | 'canShareRoom'
  >;
  readonly startRound: () => void;
  readonly nextRound: () => void;
  readonly returnToLobby: () => void;
  readonly finishPhase: () => void;
  readonly abortRound: () => void;
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
    return { sections };
  }
  const startAction: RoomHostManagementAction = buildStartGameAction({
    onPress: input.startRound,
    isEnabled: !input.isCommandSubmitting && isPictionaryRoomFull(input.state),
    isLoading: input.isCommandSubmitting || undefined,
    disabledReason: input.isCommandSubmitting
      ? null
      : `座位尚未坐满（还差 ${
          input.state.config.numberOfPlayers - getPictionaryOccupiedSeatCount(input.state)
        } 人）`,
    isPrimary: true,
    remedy: buildShareRoomRemedy(input.capabilities.canShareRoom),
    onConsolePress: () => showConfirmAlert('开始游戏？', '将开始本局绘画接龙', input.startRound),
  });
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
  return { sections };
}

export interface PictionaryRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly seatSource: RoomSeatDataSource;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly controlledSeat: RoomControlledSeatModel | null;
}

/** Assembles the Pictionary RoomShellModel from the hook's projections. */
export function createPictionaryRoomShellModel(
  input: PictionaryRoomShellModelInput,
): RoomShellModel {
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: input.state.phase,
    header: buildRoomHeaderModel({
      onBack: input.onBack,
      onTitlePress: input.onTitlePress,
      onTitleLongPress: input.onTitleLongPress,
      user: input.user,
      gachaStatus: input.gachaStatus,
      onUserActionPress: input.onUserActionPress,
    }),
    connection: input.connection,
    seats: {
      source: input.seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions: createPictionaryBottomActions(input.state, input.isHost, input.mySeat),
    hostManagement: input.hostManagement,
    controlledSeat: input.controlledSeat,
  };
}

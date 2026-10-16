/**
 * 把你画我猜权威状态投影到共享座位表与房间外壳，不暴露答案。
 */

import {
  type DrawGuessCommand,
  type DrawGuessState,
  getDrawGuessOccupiedSeatCount,
} from '@game-judge/game-engine/games/drawguess/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  buildRoomHeaderModel,
  type RoomHeaderGachaStatus,
} from '@/features/room/model/buildRoomHeaderModel';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

/** 为共享资料卡控件返回公开的席位身份。 */
function getDrawGuessProfileTarget(state: DrawGuessState, seat: number): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => `drawguess-bot:${state.roomCode}:${botSeat}`,
    getBotDisplayName,
  );
}

function drawerStatusLabel(state: DrawGuessState, seat: number): string | null {
  const phase = state.phase;
  if ((phase.kind === 'wordSelect' || phase.kind === 'drawing') && phase.drawerSeat === seat)
    return '画手中';
  if (phase.kind === 'drawing' && phase.guessedSeats.includes(seat)) return '已猜中';
  return null;
}

/** 创建共享座位表数据源：含画手/已猜中状态徽标。 */
export interface DrawGuessSeatSourceInput {
  readonly state: DrawGuessState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface DrawGuessSeatTapInput {
  readonly state: DrawGuessState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project DrawGuess seating into the shared room seat-tap contract. */
export function getDrawGuessSeatTapIntent(input: DrawGuessSeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getDrawGuessProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

function createDrawGuessSeatDataSource(input: DrawGuessSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    botUserId: (seat) => `drawguess-bot:${state.roomCode}:${seat}`,
    outOfRangeError: () => 'DrawGuess seat out of range',
    lockedSeatReason: '游戏进行中不能入座',
    resolveStatusBadge: (seat) => {
      const statusLabel = drawerStatusLabel(state, seat);
      return statusLabel === null
        ? null
        : { label: statusLabel, tone: statusLabel === '已猜中' ? 'success' : 'warning' };
    },
  });
}

export interface DrawGuessRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: DrawGuessState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly share: RoomShareModel;
  readonly isLobby: boolean;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly releaseBot: () => void;
}

export interface DrawGuessHostManagementInput {
  readonly state: DrawGuessState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: DrawGuessCommand) => Promise<boolean>;
}

/** Assembles the DrawGuess host panel for the current phase. */
export function createDrawGuessHostManagement(
  input: DrawGuessHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
  const { state, capabilities } = input;
  const roomActions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  const occupiedSeatCount = getDrawGuessOccupiedSeatCount(state);
  if (state.phase.kind === 'lobby') {
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : `座位尚未坐满（还差 ${state.config.numberOfPlayers - occupiedSeatCount} 人）`;
    const submitStart = () => void input.submit('开始游戏', { type: 'drawguess.round.start' });
    const startAction = buildStartGameAction({
      onPress: submitStart,
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
      isPrimary: true,
      remedy: buildShareRoomRemedy(capabilities.canShareRoom),
      onConsolePress: () => showConfirmAlert('开始游戏？', '将开始本局绘画猜词', submitStart),
    });
    return {
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [startAction],
        },
        { key: 'room', title: '房间管理', actions: roomActions },
      ],
    };
  }
  if (state.phase.kind === 'ended') {
    return {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            buildNextRoundAction({
              onPress: () =>
                showConfirmAlert(
                  '再来一局',
                  '重新生成画手队列并清零比分，开始新的一局。',
                  async () => {
                    await input.submit('再来一局', { type: 'drawguess.round.start' });
                  },
                ),
            }),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert('返回大厅', '保留座位和设置，清除当前对局。', async () => {
                  await input.submit('返回大厅', { type: 'drawguess.game.returnToLobby' });
                }),
            }),
          ],
        },
      ],
    };
  }
  // 局中房主面板常驻（裁决⑧，对齐狼人杀/阿瓦隆）：房间管理区始终在。
  return {
    sections: [{ key: 'room', title: '房间管理', actions: roomActions }],
  };
}

/** Assembles the DrawGuess RoomShellModel from the hook's projections. */
export function createDrawGuessRoomShellModel(input: DrawGuessRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createDrawGuessSeatDataSource({
    state,
    revision: input.revision,
    userId: input.userId,
    controlledSeat: input.controlledSeat,
  });
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
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
      source: seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    share: input.share,
    bottomActions: {
      kind: 'info',
      message: buildLobbyHostStartMessage({
        isLobby: input.isLobby,
        isHost: input.isHost,
        mySeat: input.mySeat,
      }),
      progress: null,
      actions: [],
    },
    hostManagement: input.hostManagement,
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'DrawGuess',
    }),
  };
}

/**
 * 把你画我猜权威状态投影到共享座位表与房间状态条，不暴露答案。
 */

import {
  type DrawGuessCommand,
  type DrawGuessState,
  getBotSeats,
  getDrawGuessOccupiedSeatCount,
  isBotOccupant,
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
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

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
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('DrawGuess seat out of range');
      const occupant = state.roster[seat];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const target = getDrawGuessProfileTarget(state, seat);
      const player =
        human !== undefined
          ? toRoomSeatPlayer({ kind: 'human', userId: human.userId, ...human.profile })
          : target === null
            ? null
            : toRoomSeatPlayer({
                kind: 'bot',
                userId: target.userId,
                displayName: target.rosterName,
              });
      const statusLabel = drawerStatusLabel(state, seat);
      return {
        seat,
        player,
        isSelf: human?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: null,
        showReadyBadge: false,
        statusBadge:
          statusLabel === null
            ? null
            : { label: statusLabel, tone: statusLabel === '已猜中' ? 'success' : 'warning' },
        isStatusEmphasized: false,
        showLevel: state.phase.kind === 'lobby',
        decorationsEnabled: state.phase.kind === 'lobby',
        disabledReason:
          player === null && state.phase.kind !== 'lobby' ? '游戏进行中不能入座' : undefined,
      };
    },
  };
}

/** 公共状态条：不含答案与题目内容。 */
function createDrawGuessStatusRibbon(state: DrawGuessState): RoomStatusRibbonModel | null {
  const phase = state.phase;
  if (phase.kind === 'wordSelect')
    return { kind: 'message', icon: 'guide', text: '画手正在选词', supportingText: null };
  if (phase.kind === 'drawing')
    return { kind: 'message', icon: 'guide', text: '作画猜词中', supportingText: null };
  if (phase.kind === 'roundEnd')
    return { kind: 'message', icon: 'guide', text: '本轮结算', supportingText: null };
  if (phase.kind === 'ended')
    return { kind: 'message', icon: 'guide', text: '本局已结束', supportingText: null };
  return {
    kind: 'message',
    icon: 'guide',
    text: `等待入座 · ${getDrawGuessOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
    supportingText: null,
  };
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
  readonly canControlBots: boolean;
  readonly releaseBot: () => void;
}

export interface DrawGuessHostManagementInput {
  readonly state: DrawGuessState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats'
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
    const startDisabledReason = canStart ? null : '座位尚未坐满';
    return {
      preview: '开始游戏',
      status: `等待入座 · ${occupiedSeatCount}/${state.config.numberOfPlayers}`,
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [
            buildStartGameAction({
              onPress: () => void input.submit('开始游戏', { type: 'drawguess.round.start' }),
              isEnabled: !input.isSubmitting && canStart,
              disabledReason: startDisabledReason,
              onDisabledPress: () =>
                showErrorAlert('暂时不能开始', startDisabledReason ?? '请稍后重试'),
              isLoading: input.isSubmitting,
            }),
          ],
        },
        { key: 'room', title: '房间管理', actions: roomActions },
      ],
    };
  }
  if (state.phase.kind === 'ended') {
    return {
      preview: '本局已结束',
      status: null,
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
    preview: '房主管理',
    status: null,
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
    statusRibbon: createDrawGuessStatusRibbon(state),
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
      message: input.isLobby && !input.isHost && input.mySeat !== null ? '等待房主开始游戏' : null,
      actions: [],
    },
    hostManagement: input.hostManagement,
    controlledSeat: createControlledSeatModel({
      canControlBots: input.canControlBots,
      hasBots: getBotSeats(state.roster).length > 0,
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

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
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { createRoomProfileTargetResolver } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  HOST_FLOW_CONFIRM,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

/** 为共享资料卡控件返回公开的席位身份。 */
const getDrawGuessProfileTarget = createRoomProfileTargetResolver<DrawGuessState>(
  (roomCode, botSeat) => `drawguess-bot:${roomCode}:${botSeat}`,
  getBotDisplayName,
);

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

/** Project DrawGuess seating into the shared room seat-tap contract. */
export const getDrawGuessSeatTapIntent = createRoomSeatTapIntentResolver(getDrawGuessProfileTarget);

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

export interface DrawGuessRoomShellModelInput extends Omit<
  RoomShellModelInput,
  | 'phase'
  | 'step'
  | 'seatSource'
  | 'seatConfirmation'
  | 'profile'
  | 'bottomActions'
  | 'controlledSeat'
> {
  readonly state: DrawGuessState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly isHost: boolean;
  readonly mySeat: number | null;
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
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitStart = () => void input.submit('开始游戏', { type: 'drawguess.game.begin' });
    const startAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将开始本局绘画猜词', submitStart),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
      isPrimary: true,
      remedy: buildShareRoomRemedy(capabilities.canShareRoom),
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
                  HOST_FLOW_CONFIRM.nextRoundTitle,
                  '重新生成画手队列并清零比分，开始新的一局。',
                  async () => {
                    await input.submit('再来一局', { type: 'drawguess.game.begin' });
                  },
                ),
            }),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert(
                  HOST_FLOW_CONFIRM.returnLobbyTitle,
                  HOST_FLOW_CONFIRM.returnLobbyBody,
                  async () => {
                    await input.submit('返回大厅', { type: 'drawguess.game.returnToLobby' });
                  },
                ),
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
  return createRoomShellModel({
    ...input,
    seatSource,
    phase: state.phase.kind,
    step: null,
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    bottomActions: {
      kind: 'stacked',
      // 回合结算期全员（房主也一样）等倒计时走完：给一行等待对象，
      // 与工作区内的结算倒计时同指一件事。
      message:
        state.phase.kind === 'roundEnd'
          ? '等待本轮结算'
          : buildLobbyHostStartMessage({
              isLobby: input.isLobby,
              isHost: input.isHost,
              mySeat: input.mySeat,
            }),
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    },
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'DrawGuess',
    }),
  });
}

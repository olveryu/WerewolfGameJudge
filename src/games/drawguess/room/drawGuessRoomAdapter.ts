/**
 * 把你画我猜权威状态投影到共享座位表与房间状态条，不暴露答案。
 */

import {
  type DrawGuessState,
  getDrawGuessBotDisplayName,
  getDrawGuessBotSeats,
  getDrawGuessOccupiedSeatCount,
  isBotOccupant,
  isDrawGuessBotSeat,
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
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
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

/** 为共享资料卡控件返回公开的席位身份。 */
function getDrawGuessProfileTarget(state: DrawGuessState, seat: number): RoomProfileTarget | null {
  const occupant = state.roster[seat];
  if (occupant != null && !isBotOccupant(occupant))
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isDrawGuessBotSeat(state, seat)
    ? {
        seat,
        userId: `drawguess-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getDrawGuessBotDisplayName(seat),
      }
    : null;
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
            : {
                kind: 'bot' as const,
                userId: target.userId,
                displayName: target.rosterName,
                isAnonymous: true,
              };
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

/** Assembles the DrawGuess RoomShellModel from the hook's projections. */
export function createDrawGuessRoomShellModel(input: DrawGuessRoomShellModelInput): RoomShellModel {
  const { state } = input;
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
      source: createDrawGuessSeatDataSource({
        state,
        revision: input.revision,
        userId: input.userId,
        controlledSeat: input.controlledSeat,
      }),
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
      hasBots: getDrawGuessBotSeats(state).length > 0,
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null ? getBotDisplayName(input.controlledSeat) : null,
      release: input.releaseBot,
      gameName: 'DrawGuess',
    }),
  };
}

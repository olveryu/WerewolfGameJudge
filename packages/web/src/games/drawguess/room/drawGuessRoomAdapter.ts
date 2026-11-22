/**
 * 把你画我猜权威状态投影到共享座位表与房间外壳，不暴露答案。
 */

import {
  type DrawGuessCommand,
  type DrawGuessState,
  getDrawGuessOccupiedSeatCount,
} from '@game-judge/game-engine/games/drawguess/public';

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
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import type { RoomHostAction, RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomPlayerActions';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

/** Public lobby timing and round settings, including fixed engine rules. */
export function createDrawGuessRoomSummarySettings(
  config: DrawGuessState['config'],
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: '每人轮数', value: `${config.roundsPerDrawer} 轮` },
    { label: '选词时限', value: `${config.wordSelectSeconds} 秒` },
    { label: '作画时限', value: `${config.drawingDurationSeconds} 秒` },
    { label: '提示间隔', value: `${config.hintRevealIntervalSeconds} 秒` },
    { label: '结算展示', value: `${config.roundEndSeconds} 秒` },
  ];
}

/** 为共享资料卡控件返回公开的席位身份。 */
const getDrawGuessProfileTarget = (state: DrawGuessState, seat: number): RoomProfileTarget | null =>
  getRoomProfileTarget(state.roster, seat);

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
    gameName: 'DrawGuess',
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
  | 'isAudioPlaying'
  | 'seatSource'
  | 'seatConfirmation'
  | 'profile'
  | 'playerActions'
  | 'controlledSeat'
> {
  readonly state: DrawGuessState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly gameDetails?: RoomProfileCardModel['gameDetails'];
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly releaseBot: () => void;
  /** The shared review entry for this viewer; present exactly once the game has ended. */
  readonly review: RoomReviewEntry | null;
}

export interface DrawGuessHostManagementInput {
  readonly state: DrawGuessState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    command: DrawGuessCommand,
    options: { readonly actionKey: string | null },
  ) => Promise<boolean>;
  /** The shared review entry; present exactly once the game has ended. */
  readonly review: RoomReviewEntry | null;
}

/** The review entry of an ended game; its absence there is a wiring error. */
function requireEndedReview(review: RoomReviewEntry | null): RoomReviewEntry {
  if (review === null) throw new Error('[FAIL-FAST] DrawGuess ended without a review entry');
  return review;
}

/** Assembles the DrawGuess host panel for the current phase. Host gating belongs to the shell factory. */
export function createDrawGuessHostManagement(
  input: DrawGuessHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const roomActions: RoomHostAction[] = [];
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
    const submitStart = () =>
      void input.submit(
        '开始游戏',
        { type: 'drawguess.game.begin' },
        { actionKey: HOST_ACTION_KEYS.startGame },
      );
    const startAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将开始本局绘画猜词', submitStart),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
    });
    return {
      task: hostActionTask(HOST_ACTION_KEYS.startGame),
      pendingActionKeys: [HOST_ACTION_KEYS.startGame],
      actions: [startAction, ...roomActions],
    };
  }
  const expectedPhase = state.phase.kind === 'ended' ? 'ended' : 'playing';
  const restart = buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        expectedPhase === 'ended'
          ? '保留座位和配置，清除本局画作、猜词记录和比分并回到准备。已结算的战绩和奖励保留；之后可能无法查看复盘。'
          : '保留座位和配置，清除本局画作、猜词记录和比分并回到准备。本局中止，不结算战绩与奖励。',
        '重新开始',
        async () => {
          await input.submit(
            '重新开始',
            {
              type: 'drawguess.game.restart',
              gameSequence: state.gameSequence,
              expectedPhase,
            },
            { actionKey: HOST_ACTION_KEYS.restart },
          );
        },
      ),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
  if (state.phase.kind === 'ended') {
    return {
      task: null,
      pendingActionKeys: [],
      actions: [buildReviewHostAction(requireEndedReview(input.review)), restart],
    };
  }
  return {
    task: null,
    pendingActionKeys: [],
    actions: [...roomActions, restart],
  };
}

/** Ended: seats and spectators open the review from the bottom panel; the host from the task card. */
function createDrawGuessPlayerActions(
  state: DrawGuessState,
  review: RoomReviewEntry | null,
  viewer: RoomViewer,
): readonly RoomPlayerAction[] {
  return state.phase.kind === 'ended'
    ? buildViewerReviewBottomButtons(requireEndedReview(review), viewer)
    : [];
}

/** Assembles the DrawGuess RoomShellModel from the hook's projections. */
export function createDrawGuessRoomShellModel(input: DrawGuessRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createDrawGuessSeatDataSource({
    state,
    revision: input.revision,
    userId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    seatSource,
    phase: state.phase.kind,
    step: null,
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
      gameDetails: input.gameDetails,
    }),
    playerActions: {
      // 进行中阶段是舞台内容：底部为空，结算等待由信息条的「结算」倒计时承载。
      message: buildLobbyHostStartMessage({ isLobby: input.isLobby, viewer: input.viewer }),
      progress: null,
      actions: createDrawGuessPlayerActions(state, input.review, input.viewer),
      group: null,
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

/** Pictionary-owned derivation of game-neutral RoomShell models. */

import {
  getPictionaryOccupiedSeatCount,
  getPictionaryTaskForSeat,
  isPictionaryRoomFull,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

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
import {
  type RoomCapabilities,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomPlayerActions';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

export const PICTIONARY_DISPLAY_NAME = '你画我猜接龙';

interface PictionarySeatSourceInput {
  readonly state: PictionaryState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
}

const SUBMITTED_STATUS: RoomSeatViewModel['statusBadge'] = { label: '已提交', tone: 'success' };
const ANSWERING_STATUS: RoomSeatViewModel['statusBadge'] = { label: '作答中', tone: 'warning' };

/**
 * While answering, a seat that marked its task done has handed it in; while settling, a seat
 * has handed in once its entry landed, and a reserved drawing is still uploading.
 */
function getPictionarySeatStatus(
  state: PictionaryState,
  seat: number,
): RoomSeatViewModel['statusBadge'] {
  if (state.phase !== 'answering' && state.phase !== 'settling') return null;
  const task = getPictionaryTaskForSeat(state, seat);
  if (task === null) return null;
  if (state.phase === 'answering') {
    return state.readySeats.includes(seat) ? SUBMITTED_STATUS : ANSWERING_STATUS;
  }
  if (task.chain.entries.length > state.stepIndex) return SUBMITTED_STATUS;
  if (state.reservations.some((reservation) => reservation.authorSeat === seat)) {
    return { label: '上传中', tone: 'info' };
  }
  return ANSWERING_STATUS;
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
    gameName: 'Pictionary',
    resolveStatusBadge: (seat, player) =>
      player === null ? null : getPictionarySeatStatus(state, seat),
  });
}

const getPictionaryProfileTarget = (
  state: PictionaryState,
  seat: number,
): RoomProfileTarget | null => getRoomProfileTarget(state.roster, seat);

export const getPictionarySeatTapIntent = createRoomSeatTapIntentResolver(
  getPictionaryProfileTarget,
);

/** The review entry of a finished round for seats and spectators; the host uses the task card. */
function createPictionaryReviewButtons(
  state: PictionaryState,
  review: RoomReviewEntry | null,
  viewer: RoomViewer,
): readonly RoomPlayerAction[] {
  if (state.phase !== 'ended') return [];
  if (review === null) {
    throw new Error(`[FAIL-FAST] Pictionary ${state.phase} has no review entry`);
  }
  return buildViewerReviewBottomButtons(review, viewer);
}

function createPictionaryPlayerActions(
  state: PictionaryState,
  viewer: RoomViewer,
  review: RoomReviewEntry | null,
): RoomPlayerActionModel {
  const message = buildLobbyHostStartMessage({ isLobby: state.phase === 'lobby', viewer });
  return {
    message,
    progress: null,
    actions: createPictionaryReviewButtons(state, review, viewer),
    group: null,
  };
}

interface PictionaryHostManagementInput {
  readonly state: PictionaryState;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots'
  >;
  /** The shared review entry; present once the round ended. */
  readonly review: RoomReviewEntry | null;
  readonly startRound: () => void;
  readonly restartRound: () => void;
}

/** Assembles the Pictionary host panel for the current phase. Host gating belongs to the shell factory. */
export function createPictionaryHostManagement(
  input: PictionaryHostManagementInput,
): RoomHostManagementModel {
  const isComplete =
    input.state.phase === 'gallery' ||
    input.state.phase === 'ended' ||
    (input.state.phase === 'transition' && !input.state.revealSettlementPending);
  const restart = buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        isComplete
          ? '保留座位和配置，清除本局作品并回到准备。本局已结算，请先保存需要保留的内容；之后可能无法查看复盘。'
          : '保留座位和配置，清除本局作品并回到准备。本局中止，不结算完成奖励。',
        '重新开始',
        input.restartRound,
      ),
    isEnabled: !input.isCommandSubmitting,
    isLoading: input.isCommandSubmitting || undefined,
  });
  if (input.state.phase === 'ended') {
    if (input.review === null) {
      throw new Error(`[FAIL-FAST] Pictionary ${input.state.phase} host has no review entry`);
    }
    return {
      task: null,
      pendingActionKeys: [],
      actions: [buildReviewHostAction(input.review), restart],
    };
  }
  if (input.state.phase !== 'lobby') {
    return {
      task: null,
      pendingActionKeys: [],
      actions: [restart],
    };
  }
  const startAction: RoomHostAction = buildStartGameAction({
    onPress: () =>
      showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将开始本局绘画接龙', input.startRound),
    isEnabled: !input.isCommandSubmitting && isPictionaryRoomFull(input.state),
    isLoading: input.isCommandSubmitting || undefined,
    disabledReason: input.isCommandSubmitting
      ? null
      : seatShortageReason(
          input.state.config.numberOfPlayers,
          getPictionaryOccupiedSeatCount(input.state),
        ),
  });
  const roomActions: RoomHostAction[] = [];
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
  return {
    task: hostActionTask(HOST_ACTION_KEYS.startGame),
    pendingActionKeys: [HOST_ACTION_KEYS.startGame],
    actions: [startAction, ...roomActions],
  };
}

export interface PictionaryRoomShellModelInput extends Omit<
  RoomShellModelInput,
  'phase' | 'step' | 'isAudioPlaying' | 'playerActions'
> {
  readonly state: PictionaryState;
  /** The shared review entry; present once the round ended. */
  readonly review: RoomReviewEntry | null;
}

/** Assembles the Pictionary RoomShellModel from the hook's projections. */
export function createPictionaryRoomShellModel(
  input: PictionaryRoomShellModelInput,
): RoomShellModel {
  const { state, review, ...shell } = input;
  return createRoomShellModel({
    ...shell,
    isAudioPlaying: false,
    phase: state.phase,
    step: null,
    playerActions: createPictionaryPlayerActions(state, input.viewer, review),
  });
}

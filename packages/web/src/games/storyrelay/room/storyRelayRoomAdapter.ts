/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { formatDurationOption } from '@/components/GameSettings';
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
import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomHostAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomPlayerActions';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type {
  RoomSeatDataSource,
  RoomSeatStatusBadge,
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

/** Public lobby values; every configurable field besides the card title's player count is shown. */
export function createStoryRelayRoomSummarySettings(
  config: StoryRelayState['config'],
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: '总棒数', value: `${config.numberOfPlayers} 棒` },
    { label: '写作时限', value: formatDurationOption(config.writingDurationSeconds) },
    { label: '过渡间隔', value: formatDurationOption(config.transitionDurationSeconds) },
    {
      label: '每段停留',
      value: formatDurationOption(config.galleryItemDurationSeconds, '手动翻页'),
    },
  ];
}

/** Returns a public occupant identity for shared profile controls. */
const getStoryRelayProfileTarget = (
  state: StoryRelayState,
  seat: number,
): RoomProfileTarget | null => getRoomProfileTarget(state.roster, seat);

/** Creates the shared seat-board source including public readiness and receipt status. */
export interface StoryRelaySeatSourceInput {
  readonly state: StoryRelayState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project StoryRelay seating into the shared room seat-tap contract. */
export const getStoryRelaySeatTapIntent = createRoomSeatTapIntentResolver(
  getStoryRelayProfileTarget,
);

export function createStoryRelaySeatDataSource(
  input: StoryRelaySeatSourceInput,
): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase === 'lobby',
    gameName: 'StoryRelay',
    resolveStatusBadge: (seat, player) => {
      const task = getStoryRelayTaskForSeat(state, seat);
      const statusBadge: RoomSeatStatusBadge | null =
        state.phase === 'answering'
          ? {
              label: state.readySeats.includes(seat) ? '已准备' : '写作中',
              tone: state.readySeats.includes(seat) ? 'success' : 'warning',
            }
          : state.phase === 'settling'
            ? {
                label: task?.isSubmitted ? '已收稿' : '待收稿',
                tone: task?.isSubmitted ? 'success' : 'warning',
              }
            : null;
      return player === null ? null : statusBadge;
    },
  });
}

/** The review entry of a finished round for seats and spectators; the host uses the task card. */
function createStoryRelayReviewButtons(
  state: StoryRelayState,
  review: RoomReviewEntry | null,
  viewer: RoomViewer,
): readonly RoomPlayerAction[] {
  if (state.phase !== 'ended') return [];
  if (review === null) {
    throw new Error(`[FAIL-FAST] Story Relay ${state.phase} has no review entry`);
  }
  return buildViewerReviewBottomButtons(review, viewer);
}

export interface StoryRelayRoomShellModelInput extends Omit<
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
  readonly state: StoryRelayState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly gameDetails?: RoomProfileCardModel['gameDetails'];
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly releaseBot: () => void;
  /** The shared review entry; present once the round ended. */
  readonly review: RoomReviewEntry | null;
}

export interface StoryRelayHostManagementInput {
  readonly state: StoryRelayState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  /** The shared review entry; present once the round ended. */
  readonly review: RoomReviewEntry | null;
}

/** Assembles the Story Relay host panel for the current phase. Host gating belongs to the shell factory. */
export function createStoryRelayHostManagement(
  input: StoryRelayHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const submit = input.submit;
  const roomActions: RoomHostAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  if (state.phase === 'lobby') {
    const submitStart = () => void submit('开始游戏', { type: 'storyrelay.game.begin' });
    const startAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert(
          HOST_FLOW_CONFIRM.startTitle,
          '将分配写作顺序并开始轮流讲故事',
          submitStart,
        ),
      isEnabled:
        !input.isSubmitting &&
        getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
      disabledReason: input.isSubmitting
        ? null
        : seatShortageReason(state.config.numberOfPlayers, getStoryRelayOccupiedSeatCount(state)),
      isLoading: input.isSubmitting,
    });
    return {
      task: hostActionTask(HOST_ACTION_KEYS.startGame),
      pendingActionKeys: [HOST_ACTION_KEYS.startGame],
      actions: [startAction, ...roomActions],
    };
  }
  const isTerminal = state.phase === 'ended';
  const restart = buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        state.phase === 'gallery' ||
          state.phase === 'ended' ||
          (state.phase === 'transition' &&
            state.completedAt !== null &&
            !state.revealSettlementPending)
          ? '保留座位和配置，清除当前故事并回到准备。本局已结算，请先保存需要保留的内容；之后可能无法查看复盘。'
          : '保留座位和配置，清除当前故事并回到准备。本局中止，不结算完成奖励。',
        '重新开始',
        async () => {
          await submit('重新开始', {
            type: 'storyrelay.game.restart',
            phaseRevision: state.phaseRevision,
          });
        },
      ),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
  if (isTerminal) {
    if (input.review === null) {
      throw new Error(`[FAIL-FAST] Story Relay ${state.phase} host has no review entry`);
    }
    return {
      task: null,
      pendingActionKeys: [],
      actions: [buildReviewHostAction(input.review), restart],
    };
  }
  return {
    task: null,
    pendingActionKeys: [],
    actions: [restart],
  };
}

/** Assembles the StoryRelay RoomShellModel from the hook's projections. */
export function createStoryRelayRoomShellModel(
  input: StoryRelayRoomShellModelInput,
): RoomShellModel {
  const { state } = input;
  const seatSource = createStoryRelaySeatDataSource({
    state,
    revision: input.revision,
    userId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    seatSource,
    phase: state.phase,
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
      message: buildLobbyHostStartMessage({ isLobby: input.isLobby, viewer: input.viewer }),
      // The relay steps report their progress in the stage information bar.
      progress: null,
      layout: {
        primary: [],
        secondary: createStoryRelayReviewButtons(state, input.review, input.viewer),
        ghost: [],
      },
    },
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'StoryRelay',
    }),
  });
}

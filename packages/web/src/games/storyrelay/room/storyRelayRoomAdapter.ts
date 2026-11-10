/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

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
  buildAbortGameAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildShareRoomAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostReviewClosingTask,
  hostStartTask,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import type { RoomBottomButton } from '@/features/room/model/RoomBottomActions';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
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
import { showConfirmAlert } from '@/utils/alertPresets';

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
): readonly RoomBottomButton[] {
  if (state.phase !== 'ended' && state.phase !== 'aborted') return [];
  if (review === null) {
    throw new Error(`[FAIL-FAST] Story Relay ${state.phase} has no review entry`);
  }
  return buildViewerReviewBottomButtons(review, 'secondary', viewer);
}

export interface StoryRelayRoomShellModelInput extends Omit<
  RoomShellModelInput,
  | 'phase'
  | 'step'
  | 'isAudioPlaying'
  | 'seatSource'
  | 'seatConfirmation'
  | 'profile'
  | 'bottomActions'
  | 'controlledSeat'
> {
  readonly state: StoryRelayState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly releaseBot: () => void;
  /** The shared review entry; present once the round ended or was aborted. */
  readonly review: RoomReviewEntry | null;
}

export interface StoryRelayHostManagementInput {
  readonly state: StoryRelayState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  /** The shared review entry; present once the round ended or was aborted. */
  readonly review: RoomReviewEntry | null;
}

/** Assembles the Story Relay host panel for the current phase. Host gating belongs to the shell factory. */
export function createStoryRelayHostManagement(
  input: StoryRelayHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const submit = input.submit;
  const roomActions: RoomHostManagementAction[] = [];
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
        showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将分配写作顺序并开始故事接龙', submitStart),
      isEnabled:
        !input.isSubmitting &&
        getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
      disabledReason: input.isSubmitting
        ? null
        : seatShortageReason(state.config.numberOfPlayers, getStoryRelayOccupiedSeatCount(state)),
      isLoading: input.isSubmitting,
    });
    return {
      task: hostStartTask(HOST_ACTION_KEYS.startGame),
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [startAction],
        },
        {
          key: 'room',
          title: '房间管理',
          actions: [...roomActions, buildShareRoomAction(capabilities.canShareRoom)],
        },
      ],
    };
  }
  const isTerminal = state.phase === 'ended' || state.phase === 'aborted';
  if (isTerminal) {
    if (input.review === null) {
      throw new Error(`[FAIL-FAST] Story Relay ${state.phase} host has no review entry`);
    }
    return {
      // An aborted round keeps its passages: the review stands beside 返回大厅, with no next round.
      task:
        state.phase === 'ended'
          ? hostReviewClosingTask()
          : { kind: 'choice', actionKeys: [HOST_ACTION_KEYS.review, HOST_ACTION_KEYS.returnLobby] },
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            buildReviewHostAction(input.review),
            ...(state.phase === 'ended'
              ? [
                  buildNextRoundAction({
                    onPress: () =>
                      showConfirmAlert(
                        HOST_FLOW_CONFIRM.nextRoundTitle,
                        '重新分配写作顺序并开始新一局。当前故事将被替换，请先保存需要保留的故事图片。',
                        async () => {
                          await submit('再来一局', { type: 'storyrelay.game.next' });
                        },
                      ),
                  }),
                ]
              : []),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert(
                  HOST_FLOW_CONFIRM.returnLobbyTitle,
                  '保留座位和设置，清除当前故事。请先保存需要保留的故事图片。',
                  async () => {
                    await submit('返回大厅', { type: 'storyrelay.game.returnToLobby' });
                  },
                ),
            }),
          ],
        },
      ],
    };
  }
  const canAbort =
    ['answering', 'settling', 'transition'].includes(state.phase) && state.completedAt === null;
  // 局中房主面板常驻：中止不可用时禁用并给原因，而不是整块消失。
  return {
    task: null,
    sections: [
      {
        key: 'danger',
        title: '危险操作',
        actions: [
          buildAbortGameAction({
            onPress: () =>
              showConfirmAlert(
                HOST_FLOW_CONFIRM.abortTitle,
                '将公开已收录的故事片段，本局不结算奖励。',
                async () => {
                  await submit('中止本局', {
                    type: 'storyrelay.game.abort',
                    phaseRevision: state.phaseRevision,
                  });
                },
              ),
            isEnabled: canAbort && !input.isSubmitting,
            disabledReason: canAbort ? null : '故事已完成，不能中止',
            isLoading: input.isSubmitting,
          }),
        ],
      },
    ],
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
    }),
    bottomActions: {
      kind: 'stacked',
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

/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
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
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { buildLobbyHostStartMessage } from '@/features/room/model/RoomBottomActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
} from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatStatusBadge,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

/** Returns a public occupant identity for shared profile controls. */
function getStoryRelayProfileTarget(
  state: StoryRelayState,
  seat: number,
): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => `storyrelay-bot:${state.roomCode}:${botSeat}`,
    getBotDisplayName,
  );
}

/** Creates the shared seat-board source including public readiness and receipt status. */
export interface StoryRelaySeatSourceInput {
  readonly state: StoryRelayState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface StoryRelaySeatTapInput {
  readonly state: StoryRelayState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project StoryRelay seating into the shared room seat-tap contract. */
export function getStoryRelaySeatTapIntent(input: StoryRelaySeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getStoryRelayProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

function createStoryRelaySeatDataSource(input: StoryRelaySeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase === 'lobby',
    botUserId: (seat) => `storyrelay-bot:${state.roomCode}:${seat}`,
    outOfRangeError: () => 'Story Relay seat out of range',
    lockedSeatReason: '游戏进行中不能入座',
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

/**
 * The relay steps feed the bottom panel's slim progress row; every
 * other phase has no step progress. Public progress never includes
 * story content or writer identity.
 */
function deriveStoryRelayBottomProgress(state: StoryRelayState): NightStepProgress | null {
  if (state.phase !== 'answering' && state.phase !== 'transition') return null;
  return {
    current: state.stepIndex + 1,
    total: state.config.numberOfPlayers,
    label:
      state.phase === 'transition'
        ? '稿件已收齐'
        : state.stepIndex === 0
          ? '写下故事开头'
          : '续写故事',
  };
}

export interface StoryRelayRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: StoryRelayState;
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

export interface StoryRelayHostManagementInput {
  readonly state: StoryRelayState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
}

/** Assembles the Story Relay host panel for the current phase. */
export function createStoryRelayHostManagement(
  input: StoryRelayHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
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
    const submitStart = () => void submit('开始游戏', { type: 'storyrelay.round.start' });
    const startAction = buildStartGameAction({
      onPress: () => showConfirmAlert('开始游戏？', '将分配写作顺序并开始故事接龙', submitStart),
      isEnabled:
        !input.isSubmitting &&
        getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
      disabledReason: input.isSubmitting
        ? null
        : `座位尚未坐满（还差 ${
            state.config.numberOfPlayers - getStoryRelayOccupiedSeatCount(state)
          } 人）`,
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
  const isTerminal = state.phase === 'ended' || state.phase === 'aborted';
  if (isTerminal) {
    return {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            ...(state.phase === 'ended'
              ? [
                  buildNextRoundAction({
                    onPress: () =>
                      showConfirmAlert(
                        '再来一局',
                        '重新分配写作顺序并开始新一局。当前故事将被替换，请先保存需要保留的故事图片。',
                        async () => {
                          await submit('再来一局', { type: 'storyrelay.round.next' });
                        },
                      ),
                  }),
                ]
              : []),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert(
                  '返回大厅',
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
  if (!canAbort) return null;
  return {
    sections: [
      ...(state.phase === 'answering'
        ? [
            {
              key: 'current-flow',
              title: '当前流程',
              actions: [
                {
                  key: 'finish-phase',
                  label: '结束本棒',
                  icon: 'stop-circle-outline' as const,
                  variant: 'secondary' as const,
                  isEnabled: true as const,
                  testID: 'storyrelay-finish-step',
                  onPress: () =>
                    showConfirmAlert(
                      '结束本棒',
                      '将自动收取当前文字，没有内容时自动交空白。',
                      async () => {
                        await submit('结束本棒', {
                          type: 'storyrelay.phase.finish',
                          phaseRevision: state.phaseRevision,
                        });
                      },
                    ),
                },
              ],
            },
          ]
        : []),
      {
        key: 'danger',
        title: '危险操作',
        actions: [
          {
            key: 'abort-round',
            label: '中止本局',
            icon: 'close-circle-outline',
            variant: 'danger',
            isEnabled: true,
            onPress: () =>
              showConfirmAlert('中止本局', '将公开已收录的故事片段，本局不结算奖励。', async () => {
                await submit('中止本局', {
                  type: 'storyrelay.round.abort',
                  phaseRevision: state.phaseRevision,
                });
              }),
          },
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
    userId: input.userId,
    controlledSeat: input.controlledSeat,
  });
  return {
    roomCode: input.roomCode,
    phase: state.phase,
    // The step anchor: null while this game has no sub-phase step in
    // its state. If a phase later grows a step field (the way Avalon's
    // night phase carries one), supply it verbatim here instead.
    step: null,
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
      kind: 'stacked',
      message: buildLobbyHostStartMessage({
        isLobby: input.isLobby,
        isHost: input.isHost,
        mySeat: input.mySeat,
      }),
      progress: deriveStoryRelayBottomProgress(state),
      layout: { primary: [], secondary: [], ghost: [] },
    },
    hostManagement: input.hostManagement,
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'StoryRelay',
    }),
  };
}

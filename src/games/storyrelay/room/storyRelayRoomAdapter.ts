/** Projects Story Relay state into shared seats and public room status without exposing drafts. */

import {
  getStoryRelayBotSeats,
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  isBotOccupant,
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
import { ROOM_COMMAND_FAILURE_SEATS_NOT_FULL } from '@/features/room/session/createRoomCommandFailureMessage';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

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
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('Story Relay seat out of range');
      const occupant = state.roster[seat];
      const target = getStoryRelayProfileTarget(state, seat);
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
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
      const task = getStoryRelayTaskForSeat(state, seat);
      const statusBadge: RoomSeatViewModel['statusBadge'] =
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
      return {
        seat,
        player,
        isSelf: human?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: null,
        showReadyBadge: false,
        statusBadge: player === null ? null : statusBadge,
        isStatusEmphasized: false,
        showLevel: state.phase === 'lobby',
        decorationsEnabled: state.phase === 'lobby',
        disabledReason:
          player === null && state.phase !== 'lobby' ? '游戏进行中不能入座' : undefined,
      };
    },
  };
}

/** Public status never includes story content or writer identity. */
function createStoryRelayStatusRibbon(state: StoryRelayState): RoomStatusRibbonModel | null {
  if (state.phase === 'answering' || state.phase === 'transition')
    return {
      kind: 'progress',
      current: state.stepIndex + 1,
      total: state.config.numberOfPlayers,
      label:
        state.phase === 'transition'
          ? '稿件已收齐'
          : state.stepIndex === 0
            ? '写下故事开头'
            : '续写故事',
    };
  const text =
    state.phase === 'lobby'
      ? `等待入座 · ${getStoryRelayOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`
      : state.phase === 'settling'
        ? '正在收稿'
        : state.phase === 'gallery'
          ? '故事揭晓中'
          : state.phase === 'aborted'
            ? '未完成的故事'
            : '本局故事已完成';
  return { kind: 'message', icon: 'guide', text, supportingText: null };
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
  readonly canControlBots: boolean;
  readonly releaseBot: () => void;
}

export interface StoryRelayHostManagementInput {
  readonly state: StoryRelayState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats'
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
    return {
      preview: '开始游戏',
      status: `等待入座 · ${getStoryRelayOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [
            buildStartGameAction({
              onPress: () => void submit('开始游戏', { type: 'storyrelay.round.start' }),
              isEnabled:
                !input.isSubmitting &&
                getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
              disabledReason: input.isSubmitting ? null : '座位尚未坐满',
              onDisabledPress: input.isSubmitting
                ? null
                : () => showErrorAlert('暂时不能开始', ROOM_COMMAND_FAILURE_SEATS_NOT_FULL),
              isLoading: input.isSubmitting,
            }),
          ],
        },
        { key: 'room', title: '房间管理', actions: roomActions },
      ],
    };
  }
  const isTerminal = state.phase === 'ended' || state.phase === 'aborted';
  if (isTerminal) {
    return {
      preview: state.phase === 'ended' ? '故事已揭晓' : '未完成的故事',
      status: null,
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
    preview: '管理本局',
    status: null,
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
    statusRibbon: createStoryRelayStatusRibbon(state),
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
      hasBots: getStoryRelayBotSeats(state).length > 0,
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

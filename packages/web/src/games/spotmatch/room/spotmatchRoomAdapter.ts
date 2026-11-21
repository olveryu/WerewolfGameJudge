/**
 * 把一眼成对权威状态投影到共享座位表与房间外壳。
 */

import {
  getSpotmatchOccupiedSeatCount,
  type SpotmatchCommand,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

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
  buildShareRoomAction,
  buildStartGameAction,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostStartTask,
  seatShortageReason,
} from '@/features/room/model/hostManagementActions';
import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
} from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

/** Public lobby rules that are not already represented by the card title's player count. */
export function createSpotmatchRoomSummarySettings(
  config: SpotmatchState['config'],
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: '每人牌数', value: `${config.cardsPerPlayer} 张` },
    { label: '比赛时限', value: '不限时' },
  ];
}

/** 为共享资料卡控件返回公开的席位身份。 */
const getSpotmatchProfileTarget = (state: SpotmatchState, seat: number): RoomProfileTarget | null =>
  getRoomProfileTarget(state.roster, seat);

export interface SpotmatchSeatSourceInput {
  readonly state: SpotmatchState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project Spotmatch seating into the shared room seat-tap contract. */
export const getSpotmatchSeatTapIntent = createRoomSeatTapIntentResolver(getSpotmatchProfileTarget);

function createSpotmatchSeatDataSource(input: SpotmatchSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    gameName: 'Spotmatch',
    resolveStatusBadge: (seat) => {
      const player = state.round?.players.find((entry) => entry.seat === seat);
      return player === undefined
        ? null
        : {
            label: `剩余 ${player.remaining} 张`,
            tone: player.remaining === 0 ? 'success' : 'muted',
          };
    },
  });
}

export interface SpotmatchRoomShellModelInput extends Omit<
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
  readonly state: SpotmatchState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly gameDetails: Parameters<typeof createRoomProfileCardModel>[0]['gameDetails'];
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly releaseBot: () => void;
  /** 本局复盘入口（平台 useRoomReview）；没有可复盘的对局时为 null。 */
  readonly review: RoomReviewEntry | null;
}

export interface SpotmatchHostManagementInput {
  readonly state: SpotmatchState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: SpotmatchCommand) => Promise<boolean>;
  /** 本局复盘入口；终局时必有。 */
  readonly review: RoomReviewEntry | null;
}

/** Assembles the Spotmatch host panel for the current phase. Host gating belongs to the shell factory. */
export function createSpotmatchHostManagement(
  input: SpotmatchHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const roomActions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  const occupiedSeatCount = getSpotmatchOccupiedSeatCount(state);
  if (state.phase.kind === 'lobby') {
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitStart = () => void input.submit('开始游戏', { type: 'spotmatch.game.begin' });
    const startAction = buildStartGameAction({
      onPress: () => showConfirmAlert(HOST_FLOW_CONFIRM.startTitle, '将开始本局对局', submitStart),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
    });
    // 分享房间常驻大厅房间区（禁用时带原因），是座位不满时任务卡的补救。
    return {
      task: hostStartTask(HOST_ACTION_KEYS.startGame),
      pendingActionKeys: [HOST_ACTION_KEYS.startGame],
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
  const expectedPhase = state.phase.kind;
  const restart = buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        expectedPhase === 'ended'
          ? '保留座位和配置，清除本局结果并回到准备。已结算的战绩和奖励保留；之后可能无法查看复盘。'
          : '保留座位和配置，清除本局牌面与进度并回到准备。本局中止，不结算战绩与奖励。',
        '重新开始',
        async () => {
          await input.submit('重新开始', {
            type: 'spotmatch.game.restart',
            gameSequence: state.gameSequence,
            expectedPhase,
          });
        },
      ),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
  if (expectedPhase === 'ended') {
    if (input.review === null)
      throw new Error('[FAIL-FAST] Spotmatch ended without a review entry');
    return {
      task: null,
      pendingActionKeys: [],
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [buildReviewHostAction(input.review), restart],
        },
      ],
    };
  }
  // 局中房主面板常驻：房间管理区始终在；此刻没有待操作。
  return {
    task: null,
    pendingActionKeys: [],
    sections: [
      {
        key: 'room',
        title: '房间管理',
        actions: [...roomActions, restart],
      },
    ],
  };
}

/** Assembles the Spotmatch RoomShellModel from the hook's projections. */
export function createSpotmatchRoomShellModel(input: SpotmatchRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createSpotmatchSeatDataSource({
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
      gameDetails: input.gameDetails,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    bottomActions: {
      kind: 'stacked',
      // 底部按钮必须声明 audience（participant / host / anyone），壳工厂按 viewer 校验。
      message:
        state.phase.kind === 'playing'
          ? null
          : state.phase.kind === 'ended'
            ? buildEndedWaitingMessage({ isEnded: true, viewer: input.viewer })
            : buildLobbyHostStartMessage({ isLobby: input.isLobby, viewer: input.viewer }),
      progress: null,
      // 本局复盘对玩家与观战开放（次级档）；房主从任务卡进入。
      layout: {
        primary: [],
        secondary:
          input.review === null
            ? []
            : buildViewerReviewBottomButtons(input.review, 'secondary', input.viewer),
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
      gameName: 'Spotmatch',
    }),
  });
}

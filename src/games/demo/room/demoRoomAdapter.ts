/**
 * 把Demo权威状态投影到共享座位表与房间外壳，不暴露他人身份。
 */

import {
  type DemoCommand,
  type DemoState,
  getDemoOccupiedSeatCount,
  getDemoViewingParticipants,
} from '@game-judge/game-engine/games/demo/public';
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
  allViewedConfirmBody,
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildShareRoomAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  hostClosingTask,
  hostStartTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
} from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

/** 为共享资料卡控件返回公开的席位身份。 */
const getDemoProfileTarget = createRoomProfileTargetResolver<DemoState>(
  (roomCode, botSeat) => `demo-bot:${roomCode}:${botSeat}`,
  getBotDisplayName,
);

export interface DemoSeatSourceInput {
  readonly state: DemoState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project Demo seating into the shared room seat-tap contract. */
export const getDemoSeatTapIntent = createRoomSeatTapIntentResolver(getDemoProfileTarget);

function createDemoSeatDataSource(input: DemoSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    botUserId: (seat) => `demo-bot:${state.roomCode}:${seat}`,
    outOfRangeError: () => 'Demo seat out of range',
    lockedSeatReason: '游戏进行中不能入座',
    // 已查看勾只属于查看阶段（展示契约）：开始即消失。
    resolveShowReadyBadge: (seat) =>
      state.phase.kind === 'viewing' && state.roleViewedSeats.includes(seat),
  });
}

export interface DemoRoomShellModelInput extends Omit<
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
  readonly state: DemoState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly releaseBot: () => void;
}

export interface DemoHostManagementInput {
  readonly state: DemoState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: DemoCommand) => Promise<boolean>;
}

/** Assembles the Demo host panel for the current phase. Host gating belongs to the shell factory. */
export function createDemoHostManagement(input: DemoHostManagementInput): RoomHostManagementModel {
  const { state, capabilities } = input;
  const roomActions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  if (state.phase.kind === 'lobby') {
    const occupiedSeatCount = getDemoOccupiedSeatCount(state);
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitAssign = () => void input.submit('分配角色', { type: 'demo.roles.assign' });
    const assignAction = buildAssignRolesAction({
      onPress: () =>
        showConfirmAlert(
          HOST_FLOW_CONFIRM.assignTitle,
          '所有座位已满，将为每位玩家分配身份',
          submitAssign,
        ),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
    });
    // 分享房间常驻大厅房间区（禁用时带原因），是座位不满时任务卡的补救。
    return {
      task: hostStartTask(HOST_ACTION_KEYS.assignRoles),
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [assignAction],
        },
        {
          key: 'room',
          title: '房间管理',
          actions: [...roomActions, buildShareRoomAction(capabilities.canShareRoom)],
        },
      ],
    };
  }
  if (state.phase.kind === 'viewing') {
    // 三段式中段：身份已发、对局未开始。全员查看齐后房主点「开始游戏」
    // 才进入对局（引擎 begin 门同口径，这里先给禁用态与原因）。
    const participants = getDemoViewingParticipants(state);
    const progress = projectViewingProgress(participants, state.roleViewedSeats);
    const beginGate = createViewingBeginGate({
      ...progress,
      submitting: input.isSubmitting,
      notViewedCopy: viewedProgressReason(progress.viewedCount, progress.totalSeats, '身份'),
    });
    const submitBegin = () => void input.submit('开始游戏', { type: 'demo.game.begin' });
    const beginAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert(
          HOST_FLOW_CONFIRM.startTitle,
          allViewedConfirmBody('身份', '将开始对局'),
          submitBegin,
        ),
      isEnabled: beginGate.isEnabled,
      disabledReason: beginGate.disabledReason,
      isLoading: input.isSubmitting,
    });
    const sections: RoomHostManagementSection[] = [
      {
        key: 'game',
        title: '游戏',
        actions: [beginAction],
      },
    ];
    const hasUnviewedBot = participants.some(
      (participant) => participant.isBot && !state.roleViewedSeats.includes(participant.seat),
    );
    if (hasUnviewedBot)
      sections.push({
        key: 'bot-viewing',
        title: '身份查看',
        actions: [
          buildMarkBotsViewedAction({
            onPress: () =>
              void input.submit('标记机器人已查看', {
                type: 'demo.bots.markAllBotsViewed',
              }),
            isEnabled: !input.isSubmitting,
            isLoading: input.isSubmitting,
          }),
        ],
      });
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
    // 任务始终是开始游戏：看齐前它被查看进度阻塞，机器人脚手架是补救。
    const task = hostActionTask(
      HOST_ACTION_KEYS.startGame,
      hasUnviewedBot ? { remedyActionKey: HOST_ACTION_KEYS.markBotsViewed } : {},
    );
    return { task, sections };
  }
  if (state.phase.kind === 'ended') {
    return {
      task: hostClosingTask(),
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            buildNextRoundAction({
              onPress: () =>
                showConfirmAlert(
                  HOST_FLOW_CONFIRM.nextRoundTitle,
                  '重新分配身份，开始新的一局。',
                  async () => {
                    await input.submit('再来一局', { type: 'demo.roles.assign' });
                  },
                ),
            }),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert(
                  HOST_FLOW_CONFIRM.returnLobbyTitle,
                  HOST_FLOW_CONFIRM.returnLobbyBody,
                  async () => {
                    await input.submit('返回大厅', { type: 'demo.game.returnToLobby' });
                  },
                ),
            }),
          ],
        },
      ],
    };
  }
  // 局中房主面板常驻：房间管理区始终在；此刻没有待操作。
  return {
    task: null,
    sections: [{ key: 'room', title: '房间管理', actions: roomActions }],
  };
}

/** Assembles the Demo RoomShellModel from the hook's projections. */
export function createDemoRoomShellModel(input: DemoRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createDemoSeatDataSource({
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
    }),
    bottomActions: {
      kind: 'stacked',
      // 底部按钮必须声明 audience（participant / host / anyone），壳工厂按 viewer 校验。
      message:
        state.phase.kind === 'ended'
          ? buildEndedWaitingMessage({ isEnded: true, viewer: input.viewer })
          : buildLobbyHostStartMessage({ isLobby: input.isLobby, viewer: input.viewer }),
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
      gameName: 'Demo',
    }),
  });
}

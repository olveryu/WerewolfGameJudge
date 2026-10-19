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
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  projectViewingProgress,
} from '@/features/room/model/hostManagementActions';
import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
} from '@/features/room/model/RoomBottomActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { showConfirmAlert } from '@/utils/alertPresets';

/** 为共享资料卡控件返回公开的席位身份。 */
function getDemoProfileTarget(state: DemoState, seat: number): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => `demo-bot:${state.roomCode}:${botSeat}`,
    getBotDisplayName,
  );
}

export interface DemoSeatSourceInput {
  readonly state: DemoState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface DemoSeatTapInput {
  readonly state: DemoState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project Demo seating into the shared room seat-tap contract. */
export function getDemoSeatTapIntent(input: DemoSeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getDemoProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

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

export interface DemoRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: DemoState;
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

export interface DemoHostManagementInput {
  readonly state: DemoState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: DemoCommand) => Promise<boolean>;
}

/** Assembles the Demo host panel for the current phase. */
export function createDemoHostManagement(
  input: DemoHostManagementInput,
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
  if (state.phase.kind === 'lobby') {
    const occupiedSeatCount = getDemoOccupiedSeatCount(state);
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : `座位尚未坐满（还差 ${state.config.numberOfPlayers - occupiedSeatCount} 人）`;
    const submitAssign = () => void input.submit('分配身份', { type: 'demo.game.start' });
    const assignAction = buildStartGameAction({
      label: '分配身份',
      onPress: () =>
        showConfirmAlert('分配身份？', '所有座位已满，将为每位玩家分配身份', submitAssign),
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
          actions: [assignAction],
        },
        { key: 'room', title: '房间管理', actions: roomActions },
      ],
    };
  }
  if (state.phase.kind === 'viewing') {
    // 三段式中段：身份已发、对局未开始。全员查看齐后房主点「开始游戏」
    // 才进入对局（引擎 begin 门同口径，这里先给禁用态与原因）。
    const participants = getDemoViewingParticipants(state);
    const beginGate = createViewingBeginGate({
      ...projectViewingProgress(participants, state.roleViewedSeats),
      submitting: input.isSubmitting,
      notViewedCopy: '还有玩家未查看身份',
    });
    const submitBegin = () => void input.submit('开始游戏', { type: 'demo.game.begin' });
    const beginAction = buildStartGameAction({
      onPress: () => showConfirmAlert('开始游戏？', '全员已查看身份，将开始对局', submitBegin),
      isEnabled: beginGate.isEnabled,
      disabledReason: beginGate.disabledReason,
      isLoading: input.isSubmitting,
      isPrimary: true,
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
    return { sections };
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
                showConfirmAlert('再来一局', '重新分配身份，开始新的一局。', async () => {
                  await input.submit('再来一局', { type: 'demo.game.start' });
                }),
            }),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert('返回大厅', '保留座位和设置，清除当前对局。', async () => {
                  await input.submit('返回大厅', { type: 'demo.game.returnToLobby' });
                }),
            }),
          ],
        },
      ],
    };
  }
  // 局中房主面板常驻：房间管理区始终在。
  return {
    sections: [{ key: 'room', title: '房间管理', actions: roomActions }],
  };
}

/** Assembles the Demo RoomShellModel from the hook's projections. */
export function createDemoRoomShellModel(input: DemoRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createDemoSeatDataSource({
    state,
    revision: input.revision,
    userId: input.userId,
    controlledSeat: input.controlledSeat,
  });
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: state.phase.kind,
    // The step anchor: null while this game has no sub-phase step in
    // its state. If a phase later grows a step field (the way Avalon's
    // night phase carries one), supply it verbatim here instead.
    step: null,
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
      message:
        state.phase.kind === 'ended'
          ? buildEndedWaitingMessage({
              isEnded: true,
              isHost: input.isHost,
              mySeat: input.mySeat,
            })
          : buildLobbyHostStartMessage({
              isLobby: input.isLobby,
              isHost: input.isHost,
              mySeat: input.mySeat,
            }),
      progress: null,
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
      gameName: 'Demo',
    }),
  };
}

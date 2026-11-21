/**
 * 把秘密希特勒权威状态投影到共享座位表与房间外壳，不暴露他人身份。
 */

import {
  getSecrethitlerNightParticipants,
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerUserSeat,
  getSecrethitlerViewingParticipants,
  getSecrethitlerViewModel,
  isBotSeat,
  type SecrethitlerCommand,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

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
  allViewedConfirmBody,
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildMusicSettingsAction,
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import type { RoomHostAction, RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
} from '@/features/room/model/RoomPlayerActions';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { TESTIDS } from '@/testids';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import { getSecrethitlerNightStepLabel, secrethitlerInstruction } from './secrethitlerPresentation';

/** 为共享资料卡控件返回公开的席位身份。 */
const getSecrethitlerProfileTarget = (
  state: SecrethitlerState,
  seat: number,
): RoomProfileTarget | null => getRoomProfileTarget(state.roster, seat);

export interface SecrethitlerSeatSourceInput {
  readonly state: SecrethitlerState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project Secrethitler seating into the shared room seat-tap contract. */
export const getSecrethitlerSeatTapIntent = createRoomSeatTapIntentResolver(
  getSecrethitlerProfileTarget,
);

export function createSecrethitlerSeatDataSource(
  input: SecrethitlerSeatSourceInput,
): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  const viewerSeat = controlledSeat ?? getSecrethitlerUserSeat(state, userId);
  const view = getSecrethitlerViewModel(state, viewerSeat);
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    gameName: 'Secrethitler',
    resolveSecondaryLabel: (seat, player) => {
      if (state.hostUserId !== userId || player?.occupant.kind !== 'bot') return null;
      const identity = state.identities[seat];
      return identity === undefined ? null : getSecrethitlerIdentityName(identity);
    },
    // 已查看勾只属于查看阶段（展示契约）：开始即消失。
    resolveShowReadyBadge: (seat) =>
      state.phase.kind === 'viewing' && state.roleViewedSeats.includes(seat),
    resolveHighlight: (seat) =>
      !view.hasConfirmedNight && view.knownFascistSeats.includes(seat) ? 'danger' : undefined,
    resolveIndicators: (seat) => ({
      markers: [
        ...(view.presidentSeat === seat
          ? [{ key: 'president', label: '总统', tone: 'warning' as const }]
          : []),
        ...(view.chancellorSeat === seat
          ? [{ key: 'chancellor', label: '总理', tone: 'info' as const }]
          : []),
      ],
      selection:
        state.phase.kind === 'election' && state.phase.preselectedChancellorSeat === seat
          ? { kind: 'preselected', label: '预选' }
          : null,
      progressLabel:
        state.phase.kind !== 'lobby' && !state.livingSeats.includes(seat) ? '已处决' : null,
    }),
  });
}

export interface SecrethitlerRoomShellModelInput extends Omit<
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
  readonly state: SecrethitlerState;
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
  readonly openIdentity: () => void;
  readonly openAction: () => void;
  readonly isSelecting: boolean;
  readonly isSubmitting: boolean;
}

export interface SecrethitlerHostManagementInput {
  readonly state: SecrethitlerState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly submit: (label: string, command: SecrethitlerCommand) => Promise<boolean>;
  /** 本局复盘入口；终局时必有。 */
  readonly review: RoomReviewEntry | null;
  readonly onMusicSettings: () => void;
}

/** Assembles the Secrethitler host panel for the current phase. Host gating belongs to the shell factory. */
export function createSecrethitlerHostManagement(
  input: SecrethitlerHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const hasUnviewedBot = getSecrethitlerViewingParticipants(state).some(
    (participant) => participant.isBot && !state.roleViewedSeats.includes(participant.seat),
  );
  const tools = createSecrethitlerHostTools(input, hasUnviewedBot);
  const roomActions: RoomHostAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  if (state.phase.kind === 'lobby') {
    const occupiedSeatCount = getSecrethitlerOccupiedSeatCount(state);
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitAssign = () => void input.submit('分配角色', { type: 'secrethitler.roles.assign' });
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
    return {
      task: hostActionTask(HOST_ACTION_KEYS.assignRoles),
      pendingActionKeys: [HOST_ACTION_KEYS.assignRoles],
      actions: [assignAction, ...roomActions, ...tools],
    };
  }
  if (state.phase.kind === 'viewing') {
    // 三段式中段：身份已发、对局未开始。全员查看齐后房主点「开始游戏」
    // 才进入对局（引擎 begin 门同口径，这里先给禁用态与原因）。
    const participants = getSecrethitlerViewingParticipants(state);
    const progress = projectViewingProgress(participants, state.roleViewedSeats);
    const beginGate = createViewingBeginGate({
      ...progress,
      submitting: input.isSubmitting,
      notViewedCopy: viewedProgressReason(progress.viewedCount, progress.totalSeats, '身份'),
    });
    const submitBegin = () => void input.submit('开始游戏', { type: 'secrethitler.game.begin' });
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
    const task = hostActionTask(HOST_ACTION_KEYS.startGame);
    const hostSeat = getSecrethitlerUserSeat(state, state.hostUserId);
    return {
      task,
      pendingActionKeys:
        hostSeat !== null && !state.roleViewedSeats.includes(hostSeat)
          ? []
          : [HOST_ACTION_KEYS.startGame],
      actions: [beginAction, ...roomActions, ...tools],
    };
  }
  if (state.phase.kind === 'ended') {
    if (input.review === null)
      throw new Error('[FAIL-FAST] Secrethitler ended without a review entry');
    return {
      task: { kind: 'choice', actionKeys: [HOST_ACTION_KEYS.review, 'restart'] },
      pendingActionKeys: input.review.isPending ? [HOST_ACTION_KEYS.review] : [],
      actions: [
        buildReviewHostAction(input.review),
        buildSecrethitlerRestartAction(input),
        ...tools,
      ],
    };
  }
  if (state.phase.kind === 'night') {
    const night = createNightHostManagement(input);
    return { ...night, actions: [...night.actions, ...tools] };
  }
  return {
    task: null,
    pendingActionKeys: [],
    actions: [...roomActions, ...tools],
  };
}

function buildSecrethitlerRestartAction(input: SecrethitlerHostManagementInput): RoomHostAction {
  const { state } = input;
  return buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        state.phase.kind === 'ended'
          ? input.review?.isPending
            ? '你尚未查看本局复盘。重新开始将保留座位和配置、清除本局，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
            : '保留座位和配置，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
          : '保留座位和配置，清除本局并回到准备。本局中止，不结算完成奖励。',
        '重新开始',
        async () => {
          await input.submit('重新开始', {
            type: 'secrethitler.game.restart',
            gameSequence: state.gameSequence,
            wasEnded: state.phase.kind === 'ended',
          });
        },
      ),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
}

function createSecrethitlerHostTools(
  input: SecrethitlerHostManagementInput,
  hasUnviewedBot: boolean,
): RoomHostAction[] {
  const { state } = input;
  const actions: RoomHostAction[] = [];
  if (state.phase.kind === 'lobby' || state.phase.kind === 'viewing')
    actions.push(buildMusicSettingsAction({ onPress: input.onMusicSettings }));
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended') {
    if (hasUnviewedBot)
      actions.push(
        buildMarkBotsViewedAction({
          onPress: () =>
            showConfirmAlert('标记机器人已查看？', '将标记所有未查看身份的机器人。', () => {
              void input.submit('标记机器人已查看', {
                type: 'secrethitler.bots.markAllBotsViewed',
              });
            }),
          isEnabled: !input.isSubmitting,
          isLoading: input.isSubmitting,
        }),
      );
    const phase = state.phase;
    if (
      phase.kind === 'night' &&
      getSecrethitlerNightParticipants(state).some(
        (seat) => isBotSeat(state.roster, seat) && !phase.confirmedSeats.includes(seat),
      )
    )
      actions.push(
        buildPendingAwareHostAction(
          {
            key: 'mark-bots-confirmed',
            label: '标记机器人已确认',
            icon: 'checkmark-done-outline',
            category: 'host',
            testID: TESTIDS.roomMarkBotsConfirmedButton,
          },
          input.isSubmitting,
          () =>
            showConfirmAlert('标记机器人已确认？', '将为本阶段的机器人确认信息。', () => {
              void input.submit('标记机器人已确认', {
                type: 'secrethitler.bots.markAllBotsGroupConfirmed',
              });
            }),
        ),
      );
    actions.push(buildSecrethitlerRestartAction(input));
  }
  return actions;
}

function createNightHostManagement(
  input: SecrethitlerHostManagementInput,
): RoomHostManagementModel {
  const { state } = input;
  if (state.phase.kind !== 'night') throw new Error('Night host management requires night phase');
  const phase = state.phase;
  return {
    task: null,
    pendingActionKeys: [],
    actions: [
      {
        key: 'night',
        title: '首夜语音',
        actions: [
          {
            key: 'narration-replay',
            label: '重播当前语音',
            icon: 'play-outline',
            variant: 'secondary',
            ...(!input.isSubmitting
              ? {
                  isEnabled: true,
                  onPress: () =>
                    void input.submit('重播语音', {
                      type: 'secrethitler.night.replay',
                      step: phase.step,
                    }),
                }
              : { isEnabled: false, disabledReason: '正在提交' }),
          },
        ],
      },
    ],
  };
}

/** Assembles the Secrethitler RoomShellModel from the hook's projections. */
export function createSecrethitlerRoomShellModel(
  input: SecrethitlerRoomShellModelInput,
): RoomShellModel {
  const { state } = input;
  const effectiveSeat = input.controlledSeat ?? input.viewer.seat;
  const view = getSecrethitlerViewModel(state, effectiveSeat);
  const instruction = secrethitlerInstruction(state, view);
  const identityAction = resolveViewIdentityAction({
    isVisible:
      effectiveSeat !== null && state.phase.kind !== 'lobby' && state.phase.kind !== 'ended',
    label: '查看身份',
    onPress: input.openIdentity,
  });
  const identityButton =
    identityAction === null
      ? null
      : buildViewIdentityButton(identityAction, {
          key: 'view-identity',
          audience: 'participant',
          isSubmitting: input.isSubmitting,
          isPending:
            state.phase.kind === 'viewing' &&
            effectiveSeat !== null &&
            !state.roleViewedSeats.includes(effectiveSeat),
        });
  const actionButton: RoomPlayerAction | null =
    instruction.action === null
      ? null
      : {
          key: 'game-action',
          label: input.isSelecting ? '取消选座' : instruction.action,
          audience: 'participant',
          category: 'player',
          isPending: state.phase.kind !== 'voting' || view.myVote === null,
          state: input.isSubmitting
            ? { kind: 'blocked', reason: '正在提交' }
            : { kind: 'ready', onPress: input.openAction },
        };
  const seatSource = createSecrethitlerSeatDataSource({
    state,
    revision: input.revision,
    userId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: state.isAudioPlaying,
    seatSource,
    phase: state.phase.kind,
    step: state.phase.kind === 'night' ? String(state.phase.step) : null,
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      gameDetails: input.gameDetails,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    playerActions: {
      // 底部按钮必须声明 audience（participant / host / anyone），壳工厂按 viewer 校验。
      message: input.isSelecting
        ? '请选择座位，点击后确认'
        : state.phase.kind === 'ended'
          ? buildEndedWaitingMessage({ isEnded: true, viewer: input.viewer })
          : state.phase.kind === 'lobby'
            ? buildLobbyHostStartMessage({ isLobby: true, viewer: input.viewer })
            : instruction.message,
      progress:
        state.phase.kind === 'night'
          ? {
              current: 1,
              total: 1,
              label: getSecrethitlerNightStepLabel(state.phase.step),
            }
          : null,
      group: null,
      // 本局复盘对玩家与观战开放（次级档）；房主从任务卡进入。
      actions: [
        ...(actionButton === null ? [] : [actionButton]),
        ...(identityButton === null ? [] : [identityButton]),
        ...(input.review === null
          ? []
          : buildViewerReviewBottomButtons(input.review, input.viewer)),
      ],
    },
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'Secrethitler',
    }),
  });
}

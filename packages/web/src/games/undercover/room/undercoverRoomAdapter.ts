/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getBotSeats,
  getUndercoverOccupiedSeatCount,
  getUndercoverUserSeat,
  getUndercoverViewingParticipants,
  UNDERCOVER_ROLE_NAMES,
  type UndercoverRoleCounts,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
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
  buildEnabledHostAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildShareRoomAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  hostMessageTask,
  hostStartTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import {
  createRoomSetupCapabilities,
  createShareRoomCapability,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
  RoomHostTask,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  buildReviewHostAction,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { TESTIDS } from '@/testids';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';
import { createUndercoverBottomActions } from './undercoverActionModels';

/** Resolve only public roster identity, never the secret role or word. */
export const getUndercoverProfileTarget = (
  state: UndercoverState,
  seat: number,
): RoomProfileTarget | null => getRoomProfileTarget(state.roster, seat);

/** Project Undercover seating into the shared room seat-tap contract. */
export const getUndercoverSeatTapIntent = createRoomSeatTapIntentResolver(
  getUndercoverProfileTarget,
);

interface UndercoverCapabilitiesInput extends Omit<
  RoomSetupCapabilitiesInput,
  'isSetup' | 'supportsBots' | 'hasOccupiedSeats' | 'isRoomFull'
> {
  readonly state: UndercoverState;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBots: RoomCapability<readonly [seat: number]>;
}

/** Bind shared lobby permissions and game-owned robot authority. */
export function createUndercoverRoomCapabilities(
  input: UndercoverCapabilitiesInput,
): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      ...input,
      isSetup: input.state.phase === 'lobby',
      supportsBots: true,
      hasOccupiedSeats: getUndercoverOccupiedSeatCount(input.state) > 0,
      isRoomFull:
        getUndercoverOccupiedSeatCount(input.state) === input.state.config.numberOfPlayers,
    }),
    canShareRoom: createShareRoomCapability(
      input.state.phase === 'lobby' ||
        input.state.phase === 'preparing' ||
        input.state.phase === 'preparationFailed' ||
        input.state.phase === 'viewing',
      input.shareRoom,
    ),
    canViewProfiles: createViewProfilesCapability(true, input.openProfile),
    canTakeOverBots: input.takeOverBots,
  };
}

/** Public seats reveal only eliminated roles until the authoritative winning state arrives. */
export interface UndercoverSeatSourceInput {
  readonly state: UndercoverState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
  readonly selectedSeat: number | null;
  readonly isSelecting: boolean;
}

export function createUndercoverSeatDataSource(
  input: UndercoverSeatSourceInput,
): RoomSeatDataSource {
  const { state, revision, myUserId, controlledSeat, selectedSeat, isSelecting } = input;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    // 选座是本家注入座位源的交互状态：修订键与高亮/禁用原因都随它变。
    revisionKey: `${revision}:${controlledSeat}:${selectedSeat}:${isSelecting}`,
    roster: state.roster,
    viewerUserId: myUserId,
    controlledSeat,
    isLobby: state.phase === 'lobby',
    gameName: 'Undercover',
    resolveHighlight: (seat) => (selectedSeat === seat ? 'selected' : undefined),
    resolveSecondaryLabel: (seat) => {
      const revelation = state.round?.revelations.find((entry) => entry.seat === seat);
      const role = state.phase === 'ended' ? state.round.roles[seat] : revelation?.role;
      return role === undefined
        ? null
        : `${revelation === undefined ? '' : '已出局 · '}${UNDERCOVER_ROLE_NAMES[role]}`;
    },
    resolveDisabledReason: (seat, player) => {
      const revelation = state.round?.revelations.find((entry) => entry.seat === seat);
      return isSelecting && revelation !== undefined
        ? '该玩家已出局'
        : player === null && state.phase !== 'lobby'
          ? '本局座位已锁定'
          : undefined;
    },
    resolveShowReadyBadge: (seat) =>
      state.phase === 'viewing' && state.round.confirmedSeats.includes(seat),
    resolveIsStatusEmphasized: (seat) =>
      state.round?.revelations.some((entry) => entry.seat === seat) ?? false,
  });
}

export interface UndercoverBoardInfoSectionsInput {
  readonly roleCounts: UndercoverRoleCounts;
  readonly hasBlank: boolean;
}

/** 卧底板子信息分组：卧底 / 平民，白板局时多一组白板。 */
export function createUndercoverBoardInfoSections(
  input: UndercoverBoardInfoSectionsInput,
): readonly BoardInfoSection[] {
  const { roleCounts } = input;
  const sections: BoardInfoSection[] = [
    {
      title: '卧底',
      items: [{ roleId: 'undercover', displayName: '卧底', count: roleCounts.undercover }],
      color: 'var(--color-wolf)',
    },
    {
      title: '平民',
      items: [{ roleId: 'civilian', displayName: '平民', count: roleCounts.civilian }],
      color: 'var(--color-villager)',
    },
  ];
  if (input.hasBlank) {
    sections.push({
      title: '白板',
      items: [{ roleId: 'blank', displayName: '白板', count: roleCounts.blank }],
      color: 'var(--color-text-muted)',
    });
  }
  return sections;
}

export interface UndercoverRoomShellModelInput extends Omit<
  RoomShellModelInput,
  | 'phase'
  | 'step'
  | 'isAudioPlaying'
  | 'seatSource'
  | 'bottomActions'
  | 'buildHostManagement'
  | 'controlledSeat'
> {
  readonly state: UndercoverState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly selectedSeat: number | null;
  readonly isSelecting: boolean;
  readonly controls: UndercoverRoundControls;
  /** The review （本局复盘） entry for this viewer; null while no concluded round exists. */
  readonly review: RoomReviewEntry | null;
  readonly release: () => void;
}

export interface UndercoverHostManagementInput {
  readonly state: UndercoverState;
  readonly capabilities: RoomCapabilities;
  readonly controls: UndercoverRoundControls;
  /** The review （本局复盘） entry; null while no concluded round exists. */
  readonly review: RoomReviewEntry | null;
}

/** Assembles the Undercover host panel from room facts and round controls. Host gating belongs to the shell factory. */
export function createUndercoverHostManagement(
  input: UndercoverHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities, controls } = input;
  const actions: RoomHostManagementAction[] = [];
  const roomActions: RoomHostManagementAction[] = [];
  let task: RoomHostTask | null = null;
  let pendingActionKeys: readonly string[] = [];
  if (state.phase !== 'lobby')
    actions.push(
      buildResetToLobbyAction({
        onPress: () =>
          showDestructiveAlert(
            '重新开始？',
            state.phase === 'ended'
              ? input.review?.isPending
                ? '你尚未查看本局复盘。重新开始将保留座位、配置和已用词记录，清除本局；之后可能无法查看复盘，本局已结算，奖励不会撤销。'
                : '保留座位、配置和已用词记录，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
              : '保留座位、配置和已用词记录，清除本局并回到准备。本局中止，不结算完成奖励。',
            '重新开始',
            controls.restart,
          ),
        isEnabled: !controls.isSubmitting,
        isLoading: controls.isSubmitting,
      }),
    );
  switch (state.phase) {
    case 'lobby': {
      const occupiedSeatCount = getUndercoverOccupiedSeatCount(state);
      // Player-facing seat-count wording: the panel caption and the
      // console both read this one reason (the console derives it from
      // the action). The command-failure copy stays on the
      // command-rejection channel and never renders as a caption.
      const startDisabledReason =
        occupiedSeatCount === state.config.numberOfPlayers
          ? null
          : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
      const startAction = buildAssignRolesAction({
        onPress: () =>
          showConfirmAlert(HOST_FLOW_CONFIRM.assignTitle, '将为每位玩家分配词卡', controls.start),
        isEnabled: !controls.isSubmitting && occupiedSeatCount === state.config.numberOfPlayers,
        disabledReason: startDisabledReason,
      });
      actions.push(startAction);
      task = hostStartTask(HOST_ACTION_KEYS.assignRoles);
      pendingActionKeys = [HOST_ACTION_KEYS.assignRoles];
      if (capabilities.canConfigureGame.isAllowed)
        roomActions.push(
          buildRoomConfigAction({
            onPress: capabilities.canConfigureGame.execute,
          }),
        );
      if (capabilities.canFillBots.isAllowed)
        roomActions.push(
          buildFillBotsAction({
            onPress: capabilities.canFillBots.execute,
          }),
        );
      if (capabilities.canClearSeats.isAllowed)
        roomActions.push(
          buildClearSeatsAction({
            onPress: capabilities.canClearSeats.execute,
          }),
        );
      // 分享房间常驻大厅房间区，是座位不满时任务卡的补救。
      roomActions.push(buildShareRoomAction(capabilities.canShareRoom));
      break;
    }
    case 'preparing':
      // The preparing status is the shared bottom message; nothing awaits the host.
      break;
    case 'viewing': {
      // The begin gate mirrors the engine checkpoint: play opens only
      // once every participant seat has viewed; the panel shows why it
      // is disabled. The projection is set-based like the engine's
      // haveAllViewed — a raw confirmedSeats length would let a stale
      // record for an unoccupied seat open the gate early.
      const progress = projectViewingProgress(
        getUndercoverViewingParticipants(state),
        state.round.confirmedSeats,
      );
      const beginGate = createViewingBeginGate({
        ...progress,
        submitting: controls.isSubmitting,
        notViewedCopy: viewedProgressReason(progress.viewedCount, progress.totalSeats, '词卡'),
      });
      const beginAction = buildStartGameAction({
        onPress: () =>
          showConfirmAlert(
            HOST_FLOW_CONFIRM.startTitle,
            allViewedConfirmBody('词卡', '将开始轮流发言'),
            controls.begin,
          ),
        isEnabled: beginGate.isEnabled,
        disabledReason: beginGate.disabledReason,
      });
      actions.push(beginAction);
      const hasUnviewedBot = getBotSeats(state.roster).some(
        (seat) => !state.round.confirmedSeats.includes(seat),
      );
      if (hasUnviewedBot)
        actions.push(
          buildMarkBotsViewedAction({
            onPress: () =>
              showConfirmAlert(
                '标记机器人已查看？',
                '将标记所有未查看词卡的机器人。',
                controls.markAllBotsViewed,
              ),
            isEnabled: !controls.isSubmitting,
            isLoading: controls.isSubmitting,
          }),
        );
      // The task is the start; until every seat viewed it is blocked by the
      // sheet action's reason, with the bot scaffold as the remedy.
      task = hostActionTask(
        HOST_ACTION_KEYS.startGame,
        hasUnviewedBot ? { remedyActionKey: HOST_ACTION_KEYS.markBotsViewed } : {},
      );
      const hostSeat = getUndercoverUserSeat(state, state.hostUserId);
      pendingActionKeys =
        hostSeat !== null && !state.round.confirmedSeats.includes(hostSeat)
          ? []
          : [HOST_ACTION_KEYS.startGame];
      break;
    }
    case 'preparationFailed':
      pendingActionKeys = [];
      actions.push(
        buildPendingAwareHostAction(
          {
            key: 'retry',
            label: '重新准备',
            icon: 'refresh-outline',
            variant: 'primary',
            testID: TESTIDS.undercoverRetry,
          },
          controls.isSubmitting,
          controls.retry,
        ),
      );
      task = hostActionTask('retry');
      if (state.failureCode === 'inventoryExhausted')
        actions.push(
          buildPendingAwareHostAction(
            {
              key: 'allow-repeated',
              label: '本次允许重复词对',
              icon: 'repeat-outline',
              variant: 'secondary',
              testID: TESTIDS.undercoverAllowRepeated,
            },
            controls.isSubmitting,
            controls.allowRepeated,
          ),
        );
      break;
    case 'ongoing':
      // 选人是房主本地模式：进入与退出是一对面板动作；选人中任务卡给
      // 座位盘指示并以「取消选择」为退出。
      if (controls.isSelecting) {
        pendingActionKeys = [];
        actions.push(
          buildEnabledHostAction(
            {
              key: 'cancel-selection',
              label: '取消选择',
              icon: 'close-circle-outline',
              variant: 'secondary',
              testID: TESTIDS.undercoverCancelSelection,
            },
            controls.cancelSelection,
          ),
        );
        task = hostMessageTask('点座位盘选择本次出局玩家', { actionKey: 'cancel-selection' });
      } else {
        pendingActionKeys = ['select-player'];
        actions.push(
          buildPendingAwareHostAction(
            {
              key: 'select-player',
              label: '选择出局玩家',
              icon: 'person-remove-outline',
              variant: 'primary',
              testID: TESTIDS.undercoverSelectPlayer,
            },
            controls.isSubmitting,
            controls.beginSelection,
          ),
        );
        task = hostActionTask('select-player');
      }
      break;
    case 'ended': {
      pendingActionKeys =
        state.phase === 'ended' && input.review?.isPending ? [HOST_ACTION_KEYS.review] : [];
      if (input.review === null && state.phase === 'ended')
        throw new Error('[FAIL-FAST] Undercover ended host has no review entry');
      if (input.review !== null) {
        actions.unshift(buildReviewHostAction(input.review));
        task = { kind: 'choice', actionKeys: [HOST_ACTION_KEYS.review, 'restart'] };
      } else {
        task = hostActionTask('restart');
      }
      break;
    }
  }
  const sections: RoomHostManagementSection[] = [{ key: 'game', title: '游戏', actions }];
  if (roomActions.length > 0)
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
  return {
    task,
    sections,
    pendingActionKeys,
    ...(state.phase === 'preparationFailed' ? { hasPendingDecision: true } : {}),
  };
}

/** Assembles the Undercover RoomShellModel from the hook's projections. */
export function createUndercoverRoomShellModel(
  input: UndercoverRoomShellModelInput,
): RoomShellModel {
  const { state } = input;
  const seatSource = createUndercoverSeatDataSource({
    state,
    revision: input.revision,
    myUserId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
    selectedSeat: input.selectedSeat,
    isSelecting: input.isSelecting,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    seatSource,
    phase: state.phase,
    step: null,
    bottomActions: createUndercoverBottomActions(input.controls, state, input.viewer, input.review),
    buildHostManagement: () =>
      createUndercoverHostManagement({
        state,
        capabilities: input.capabilities,
        controls: input.controls,
        review: input.review,
      }),
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.release,
      gameName: 'Undercover',
    }),
  });
}

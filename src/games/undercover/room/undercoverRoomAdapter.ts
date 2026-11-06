/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getBotSeats,
  getUndercoverOccupiedSeatCount,
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
  buildAbortGameAction,
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildEnabledHostAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
  buildRestartGameAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildShareRoomAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  hostClosingTask,
  hostMessageTask,
  hostStartTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import {
  createRoomSetupCapabilities,
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
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

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
      color: colors.wolf,
    },
    {
      title: '平民',
      items: [{ roleId: 'civilian', displayName: '平民', count: roleCounts.civilian }],
      color: colors.villager,
    },
  ];
  if (input.hasBlank) {
    sections.push({
      title: '白板',
      items: [{ roleId: 'blank', displayName: '白板', count: roleCounts.blank }],
      color: colors.textMuted,
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
  readonly release: () => void;
}

export interface UndercoverHostManagementInput {
  readonly state: UndercoverState;
  readonly capabilities: RoomCapabilities;
  readonly controls: UndercoverRoundControls;
}

/** Assembles the Undercover host panel from room facts and round controls. Host gating belongs to the shell factory. */
export function createUndercoverHostManagement(
  input: UndercoverHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities, controls } = input;
  const actions: RoomHostManagementAction[] = [];
  const roomActions: RoomHostManagementAction[] = [];
  let task: RoomHostTask | null = null;
  const abortAction = () =>
    buildAbortGameAction({
      onPress: controls.abort,
      isEnabled: !controls.isSubmitting,
      isLoading: controls.isSubmitting,
    });
  const returnLobbyAction = () =>
    buildReturnLobbyAction({
      onPress: controls.returnToLobby,
      isEnabled: !controls.isSubmitting,
      isLoading: controls.isSubmitting,
    });
  if (state.phase !== 'lobby' && state.phase !== 'ended' && state.phase !== 'aborted')
    actions.push(
      buildRestartGameAction({
        onPress: controls.restart,
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
      actions.push(abortAction());
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
            onPress: controls.markAllBotsViewed,
            isEnabled: !controls.isSubmitting,
            isLoading: controls.isSubmitting,
          }),
        );
      actions.push(abortAction());
      // The task is the start; until every seat viewed it is blocked by the
      // sheet action's reason, with the bot scaffold as the remedy.
      task = hostActionTask(
        HOST_ACTION_KEYS.startGame,
        hasUnviewedBot ? { remedyActionKey: HOST_ACTION_KEYS.markBotsViewed } : {},
      );
      break;
    }
    case 'preparationFailed':
      actions.push(
        buildPendingAwareHostAction(
          {
            key: 'retry',
            label: '重新准备',
            icon: 'refresh-outline',
            variant: 'primary',
            testID: 'undercover-retry',
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
              testID: 'undercover-allow-repeated',
            },
            controls.isSubmitting,
            controls.allowRepeated,
          ),
        );
      actions.push(returnLobbyAction());
      break;
    case 'ongoing':
      // 选人是房主本地模式：进入与退出是一对面板动作；选人中任务卡给
      // 座位盘指示并以「取消选择」为退出。
      if (controls.isSelecting) {
        actions.push(
          buildEnabledHostAction(
            {
              key: 'cancel-selection',
              label: '取消选择',
              icon: 'close-circle-outline',
              variant: 'secondary',
              testID: 'undercover-cancel-selection',
            },
            controls.cancelSelection,
          ),
        );
        task = hostMessageTask('点座位盘选择本次出局玩家', { actionKey: 'cancel-selection' });
      } else {
        actions.push(
          buildPendingAwareHostAction(
            {
              key: 'select-player',
              label: '选择出局玩家',
              icon: 'person-remove-outline',
              variant: 'primary',
              testID: 'undercover-select-player',
            },
            controls.isSubmitting,
            controls.beginSelection,
          ),
        );
        task = hostActionTask('select-player');
      }
      actions.push(abortAction());
      break;
    case 'ended':
    case 'aborted':
      actions.push(
        buildNextRoundAction({
          onPress: () =>
            showConfirmAlert(
              HOST_FLOW_CONFIRM.nextRoundTitle,
              '重新分配词语与身份，开始新的一局。',
              controls.restart,
            ),
          isEnabled: !controls.isSubmitting,
          isLoading: controls.isSubmitting,
        }),
      );
      actions.push(returnLobbyAction());
      task =
        state.phase === 'ended' ? hostClosingTask() : hostActionTask(HOST_ACTION_KEYS.returnLobby);
      break;
  }
  const sections: RoomHostManagementSection[] = [{ key: 'game', title: '游戏', actions }];
  if (roomActions.length > 0)
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
  return { task, sections };
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
    bottomActions: createUndercoverBottomActions(input.controls, state, input.viewer),
    buildHostManagement: () =>
      createUndercoverHostManagement({
        state,
        capabilities: input.capabilities,
        controls: input.controls,
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

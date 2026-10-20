/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getBotSeats,
  getUndercoverOccupiedSeatCount,
  getUndercoverUserSeat,
  getUndercoverViewingParticipants,
  type UndercoverCategory,
  type UndercoverRole,
  type UndercoverRoleCounts,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import {
  buildRoomHeaderModel,
  type RoomHeaderGachaStatus,
} from '@/features/room/model/buildRoomHeaderModel';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  allViewedConfirmBody,
  buildAbortGameAction,
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
  buildRestartGameAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_FLOW_CONFIRM,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomProfileTarget,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementModel,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';
import { createUndercoverBottomActions } from './undercoverActionModels';

export const UNDERCOVER_ROLE_NAMES: Readonly<Record<UndercoverRole, string>> = {
  civilian: '平民',
  undercover: '卧底',
  blank: '白板',
};
export const UNDERCOVER_CATEGORY_NAMES: Readonly<Record<UndercoverCategory | 'all', string>> = {
  all: '全部分类',
  food: '吃喝美食',
  dailyLife: '日常生活',
  school: '校园学习',
  work: '职场工作',
  relationships: '人际关系',
  actions: '动作状态',
  entertainment: '文娱休闲',
  sportsAndGames: '运动游戏',
  travel: '出行旅行',
  nature: '自然世界',
};

/** Resolve only public roster identity, never the secret role or word. */
export function getUndercoverProfileTarget(
  state: UndercoverState,
  seat: number,
): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => `undercover-bot:${state.roomCode}:${botSeat}`,
    getBotDisplayName,
  );
}

interface UndercoverCapabilitiesInput extends Omit<
  RoomSetupCapabilitiesInput,
  'isSetup' | 'supportsBots' | 'hasOccupiedSeats' | 'isRoomFull'
> {
  readonly state: UndercoverState;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
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
    canViewProfiles: { isAllowed: true, execute: input.openProfile },
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
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
    botUserId: (seat) => `undercover-bot:${state.roomCode}:${seat}`,
    outOfRangeError: (seat) => `Undercover seat source index is out of range: ${seat}`,
    lockedSeatReason: '本局座位已锁定',
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

export interface UndercoverRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: UndercoverState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
  readonly selectedSeat: number | null;
  readonly isSelecting: boolean;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly isHost: boolean;
  readonly controls: UndercoverRoundControls;
  readonly release: () => void;
}

export interface UndercoverHostManagementInput {
  readonly state: UndercoverState;
  readonly isHost: boolean;
  readonly capabilities: RoomCapabilities;
  readonly controls: UndercoverRoundControls;
}

/** Assembles the Undercover host panel from room facts and round controls. */
export function createUndercoverHostManagement(
  input: UndercoverHostManagementInput,
): RoomHostManagementModel | null {
  const { state, isHost, capabilities, controls } = input;
  if (!isHost) return null;
  const actions: RoomHostManagementAction[] = [];
  const roomActions: RoomHostManagementAction[] = [];
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
        isPrimary: true,
        remedy: buildShareRoomRemedy(capabilities.canShareRoom),
      });
      actions.push(startAction);
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
      break;
    }
    case 'preparing':
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
        isPrimary: true,
      });
      actions.push(beginAction);
      if (getBotSeats(state.roster).some((seat) => !state.round.confirmedSeats.includes(seat)))
        actions.push(
          buildMarkBotsViewedAction({
            onPress: controls.markAllBotsViewed,
            isEnabled: !controls.isSubmitting,
            isLoading: controls.isSubmitting,
          }),
        );
      actions.push(abortAction());
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
      break;
  }
  const sections: RoomHostManagementSection[] = [{ key: 'game', title: '游戏', actions }];
  if (roomActions.length > 0)
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
  return { sections };
}

/** Assembles the Undercover RoomShellModel from the hook's projections. */
export function createUndercoverRoomShellModel(
  input: UndercoverRoomShellModelInput,
): RoomShellModel {
  const { state } = input;
  const seatSource = createUndercoverSeatDataSource({
    state,
    revision: input.revision,
    myUserId: input.myUserId,
    controlledSeat: input.controlledSeat,
    selectedSeat: input.selectedSeat,
    isSelecting: input.isSelecting,
  });
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: state.phase,
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
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions: createUndercoverBottomActions(input.controls, state, {
      isHost: input.isHost,
      mySeat: getUndercoverUserSeat(state, input.myUserId),
    }),
    hostManagement: createUndercoverHostManagement({
      state,
      isHost: input.isHost,
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
  };
}

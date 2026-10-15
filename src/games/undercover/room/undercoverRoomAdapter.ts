/** Undercover projections for the shared room shell; no I/O or client-side game decisions. */

import {
  getBotSeats,
  getUndercoverOccupiedSeatCount,
  isBotOccupant,
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
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomProfileTarget,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import { buildLobbyWaitingText, messageRibbon } from '@/features/room/model/statusRibbon';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { ROOM_COMMAND_FAILURE_SEATS_NOT_FULL } from '@/features/room/session/createRoomCommandFailureMessage';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';
import { createUndercoverBottomActions } from './undercoverActionModels';

const UNDERCOVER_ROLE_NAMES: Readonly<Record<UndercoverRole, string>> = {
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
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat}:${selectedSeat}:${isSelecting}`,
    getSeat(seat) {
      const target = getUndercoverProfileTarget(state, seat);
      const occupant = state.roster[seat];
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const revelation = state.round?.revelations.find((entry) => entry.seat === seat);
      const role = state.phase === 'ended' ? state.round.roles[seat] : revelation?.role;
      return {
        seat,
        player:
          target === null
            ? null
            : toRoomSeatPlayer({
                kind: target.occupantKind,
                userId: target.userId,
                ...human?.profile,
                displayName: target.rosterName,
              }),
        isSelf: human?.userId === myUserId,
        highlight:
          selectedSeat === seat ? 'selected' : controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel:
          role === undefined
            ? null
            : `${revelation === undefined ? '' : '已出局 · '}${UNDERCOVER_ROLE_NAMES[role]}`,
        disabledReason:
          isSelecting && revelation !== undefined
            ? '该玩家已出局'
            : target === null && state.phase !== 'lobby'
              ? '本局座位已锁定'
              : undefined,
        showReadyBadge: state.phase === 'viewing' && state.round.confirmedSeats.includes(seat),
        statusBadge: null,
        isStatusEmphasized: revelation !== undefined,
        showLevel: state.phase === 'lobby',
        decorationsEnabled: state.phase === 'lobby',
      };
    },
  };
}

/** Status text contains no hidden identities or words. */
export function createUndercoverStatusRibbon(state: UndercoverState): RoomStatusRibbonModel | null {
  let text: string;
  switch (state.phase) {
    case 'lobby':
      text = buildLobbyWaitingText(
        getUndercoverOccupiedSeatCount(state),
        state.config.numberOfPlayers,
      );
      break;
    case 'preparing':
      text = '正在准备词语';
      break;
    case 'preparationFailed':
      text =
        state.failureCode === 'inventoryEmpty'
          ? '暂无可用词语'
          : state.failureCode === 'inventoryExhausted'
            ? '该类别的新词已用完'
            : '词语准备失败';
      break;
    case 'viewing':
      // 查看阶段展示契约：未齐报进度，齐了报等待房主开始（两态只出状态条）。
      text =
        state.round.confirmedSeats.length >= state.config.numberOfPlayers
          ? '全员已查看词卡，等待房主开始游戏'
          : `等待全员查看词卡 · ${state.round.confirmedSeats.length}/${state.config.numberOfPlayers}`;
      break;
    case 'ongoing':
      text = `游戏进行中 · 存活 ${state.config.numberOfPlayers - state.round.revelations.length} 人`;
      break;
    case 'ended':
      text = `${UNDERCOVER_ROLE_NAMES[state.winner]}获胜`;
      break;
    case 'aborted':
      text = '本局已中止';
      break;
  }
  return messageRibbon(
    text,
    state.phase === 'ongoing'
      ? `首轮从 ${state.round.speakingStartSeat + 1} 号开始发言（随机）`
      : null,
    state.phase === 'ongoing' ? 'speaking' : 'guide',
  );
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
  const add = (
    key: string,
    label: string,
    icon: RoomHostManagementAction['icon'],
    onPress: () => void,
    variant: RoomHostManagementAction['variant'] = 'secondary',
    isAllowed = true,
  ) => {
    actions.push({
      key,
      label,
      icon,
      variant,
      testID: `undercover-${key}`,
      ...(controls.isSubmitting || !isAllowed
        ? ({
            isEnabled: false,
            disabledReason: isAllowed ? null : ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
            onDisabledPress: null,
          } as const)
        : ({ isEnabled: true, onPress } as const)),
    });
  };
  if (state.phase !== 'lobby' && state.phase !== 'ended' && state.phase !== 'aborted')
    add('restart', '重新开始', 'refresh-outline', controls.restart);
  switch (state.phase) {
    case 'lobby':
      actions.push(
        buildStartGameAction({
          label: '开始本局',
          onPress: controls.start,
          isEnabled:
            !controls.isSubmitting &&
            getUndercoverOccupiedSeatCount(state) === state.config.numberOfPlayers,
          disabledReason:
            getUndercoverOccupiedSeatCount(state) === state.config.numberOfPlayers
              ? null
              : ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
        }),
      );
      if (capabilities.canConfigureGame.isAllowed)
        actions.push(
          buildRoomConfigAction({
            onPress: capabilities.canConfigureGame.execute,
          }),
        );
      if (capabilities.canFillBots.isAllowed)
        actions.push(
          buildFillBotsAction({
            onPress: capabilities.canFillBots.execute,
          }),
        );
      if (capabilities.canClearSeats.isAllowed)
        actions.push(
          buildClearSeatsAction({
            onPress: capabilities.canClearSeats.execute,
          }),
        );
      break;
    case 'preparing':
      add('abort', '中止本局', 'stop-circle-outline', controls.abort, 'danger');
      break;
    case 'viewing': {
      // The begin gate mirrors the engine checkpoint: play opens only
      // once every seat has viewed; the panel shows why it is disabled.
      const allViewed = state.round.confirmedSeats.length === state.config.numberOfPlayers;
      const beginDisabledReason = allViewed ? null : '还有玩家未查看词卡';
      actions.push(
        buildStartGameAction({
          label: '开始游戏',
          onPress: controls.begin,
          isEnabled: !controls.isSubmitting && allViewed,
          disabledReason: beginDisabledReason,
          onDisabledPress: () =>
            showErrorAlert('暂时不能开始', beginDisabledReason ?? '请稍后重试'),
        }),
      );
      if (getBotSeats(state.roster).some((seat) => !state.round.confirmedSeats.includes(seat)))
        actions.push(
          buildMarkBotsViewedAction({
            onPress: controls.markAllBotsViewed,
            isEnabled: !controls.isSubmitting,
            isLoading: controls.isSubmitting,
          }),
        );
      add('abort', '中止本局', 'stop-circle-outline', controls.abort, 'danger');
      break;
    }
    case 'preparationFailed':
      add('retry', '重新准备', 'refresh-outline', controls.retry, 'primary');
      if (state.failureCode === 'inventoryExhausted')
        add('allow-repeated', '本次允许重复词对', 'repeat-outline', controls.allowRepeated);
      add('return-lobby', '返回大厅', 'return-down-back-outline', controls.returnToLobby);
      break;
    case 'ongoing':
      add(
        'select-player',
        '选择出局玩家',
        'person-remove-outline',
        controls.beginSelection,
        'primary',
      );
      add('abort', '中止本局', 'stop-circle-outline', controls.abort, 'danger');
      break;
    case 'ended':
    case 'aborted':
      add('restart', '重新开始', 'refresh-outline', controls.restart, 'primary');
      add(
        'return-lobby',
        '返回大厅',
        'return-down-back-outline',
        controls.returnToLobby,
        'secondary',
      );
      break;
  }
  return {
    preview: state.phase === 'ongoing' ? '选择出局玩家' : '对局管理',
    status: null,
    sections: [{ key: 'game', title: '房主操作', actions }],
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
    myUserId: input.myUserId,
    controlledSeat: input.controlledSeat,
    selectedSeat: input.selectedSeat,
    isSelecting: input.isSelecting,
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
    statusRibbon: createUndercoverStatusRibbon(state),
    seats: {
      source: seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions: createUndercoverBottomActions(input.controls),
    hostManagement: createUndercoverHostManagement({
      state,
      isHost: input.isHost,
      capabilities: input.capabilities,
      controls: input.controls,
    }),
    controlledSeat: createControlledSeatModel({
      canControlBots: input.capabilities.canTakeOverBots.isAllowed,
      hasBots: getBotSeats(state.roster).length > 0,
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

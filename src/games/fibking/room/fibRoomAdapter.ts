/** FibKing-owned derivation of game-neutral RoomShell models. */

import {
  type FibRole,
  type FibState,
  getFibOccupiedSeatCount,
  getFibRole,
  getFibViewingParticipants,
  isFibRoomFull,
} from '@game-judge/game-engine/games/fibking/public';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
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
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
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
import type {
  RoomBottomButton,
  RoomBottomButtonAudience,
  RoomBottomStackModel,
} from '@/features/room/model/RoomBottomActions';
import {
  buildPreparationFailureMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomBottomActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomProfileTarget,
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
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

export const FIB_DISPLAY_NAME = '瞎掰王';

const FIB_ROLE_NAMES: Readonly<Record<FibRole, string>> = {
  guesser: '大聪明',
  honest: '老实人',
  fibber: '瞎掰王',
};

interface FibCapabilitiesInput {
  readonly state: FibState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly leaveSeat: () => void;
  readonly kickSeat: (seat: number) => void;
  readonly clearSeats: () => void;
  readonly fillBots: () => void;
  readonly configureGame: () => void;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
  readonly shareRoom: () => void;
}

export function createFibRoomCapabilities(input: FibCapabilitiesInput): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  const occupiedCount = getFibOccupiedSeatCount(input.state);
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup: isLobby,
    isHost: input.isHost,
    supportsBots: true,
    mySeat: input.mySeat,
    hasOccupiedSeats: occupiedCount > 0,
    isRoomFull: isFibRoomFull(input.state),
    requestTakeSeat: input.requestTakeSeat,
    requestMoveSeat: input.requestMoveSeat,
    leaveSeat: input.leaveSeat,
    kickSeat: input.kickSeat,
    clearSeats: input.clearSeats,
    fillBots: input.fillBots,
    configureGame: input.configureGame,
    shareRoom: input.shareRoom,
  });

  return {
    ...setupCapabilities,
    canViewProfiles: createViewProfilesCapability(true, input.openProfile),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
  };
}

export const getFibProfileTarget = (state: FibState, seat: number): RoomProfileTarget | null =>
  getRoomProfileTarget(state.roster, seat);

/** Project Fib sparse seating into the shared room seat-tap contract. */
export const getFibSeatTapIntent = createRoomSeatTapIntentResolver(getFibProfileTarget);

function getSeatRoleLabel(state: FibState, seat: number): string | null {
  if (
    state.phase === 'lobby' ||
    state.phase === 'preparing' ||
    state.phase === 'preparationFailed'
  ) {
    return null;
  }
  const role = getFibRole(state.round.roles, seat);
  if (state.phase === 'viewing' && role !== 'guesser') {
    return null;
  }
  // Ongoing keeps roles hidden except the guesser's, until the host's
  // guess publicly reveals a seat's real role.
  if (
    state.phase === 'ongoing' &&
    role !== 'guesser' &&
    !state.round.guesses.some((guess) => guess.seat === seat)
  ) {
    return null;
  }
  return FIB_ROLE_NAMES[role];
}

interface FibSeatSourceInput {
  readonly state: FibState;
  readonly revision: number;
  readonly myUserId: string;
  readonly controlledSeat: number | null;
}

export function createFibSeatDataSource(input: FibSeatSourceInput): RoomSeatDataSource {
  const { state } = input;
  return createRoomSeatDataSource({
    seatCount: state.numberOfPlayers,
    revision: input.revision,
    roster: state.roster,
    viewerUserId: input.myUserId,
    controlledSeat: input.controlledSeat,
    isLobby: state.phase === 'lobby',
    gameName: 'Fib',
    resolveSecondaryLabel: (seat, player) =>
      player === null ? null : getSeatRoleLabel(state, seat),
    // Per-seat viewed badge (public record): the check belongs to the
    // viewing stage only — it clears the moment the round begins.
    resolveShowReadyBadge: (seat) =>
      state.phase === 'viewing' && state.round !== null && state.round.viewedSeats.includes(seat),
  });
}

interface FibHostManagementInput {
  readonly state: FibState;
  readonly isCommandSubmitting: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canClearSeats' | 'canFillBots' | 'canShareRoom'
  >;
  readonly startRound: () => void;
  readonly markAllBotsViewed: () => void;
  readonly beginRound: () => void;
  readonly isGuessing: boolean;
  readonly toggleGuessMode: () => void;
  readonly cancelPreparing: () => void;
  readonly revealRound: () => void;
  readonly redrawRound: () => void;
  readonly abandonGame: () => void;
  readonly endGame: () => void;
}

function createFibCurrentFlowActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  switch (input.state.phase) {
    case 'viewing': {
      // Identity scaffold (aligned with werewolf): while bot seats
      // are unmarked, the host can fill their viewed records. The
      // begin gate mirrors the engine checkpoint: play opens only
      // once every seat has viewed, and the panel shows why not.
      const round = input.state.round;
      if (round === null) return [];
      const participants = getFibViewingParticipants(input.state);
      const progress = projectViewingProgress(participants, round.viewedSeats);
      const beginGate = createViewingBeginGate({
        ...progress,
        submitting: input.isCommandSubmitting,
        notViewedCopy: viewedProgressReason(progress.viewedCount, progress.totalSeats, '身份'),
      });
      const actions: RoomHostManagementAction[] = [
        buildStartGameAction({
          onPress: () =>
            showConfirmAlert(
              HOST_FLOW_CONFIRM.startTitle,
              allViewedConfirmBody('身份', '将开始本轮描述'),
              input.beginRound,
            ),
          isEnabled: beginGate.isEnabled,
          isLoading: input.isCommandSubmitting || undefined,
          disabledReason: beginGate.disabledReason,
        }),
      ];
      const hasUnviewedBot = participants.some(
        (participant) => participant.isBot && !round.viewedSeats.includes(participant.seat),
      );
      if (hasUnviewedBot) {
        actions.push(
          buildMarkBotsViewedAction({
            onPress: input.markAllBotsViewed,
            isEnabled: !input.isCommandSubmitting,
            isLoading: input.isCommandSubmitting,
          }),
        );
      }
      return actions;
    }
    case 'lobby': {
      return [
        buildAssignRolesAction({
          onPress: () =>
            showConfirmAlert(
              HOST_FLOW_CONFIRM.assignTitle,
              '将为每位玩家分配身份并准备本轮词语',
              input.startRound,
            ),
          isEnabled: !input.isCommandSubmitting && isFibRoomFull(input.state),
          isLoading: input.isCommandSubmitting || undefined,
          disabledReason: input.isCommandSubmitting
            ? null
            : seatShortageReason(input.state.numberOfPlayers, getFibOccupiedSeatCount(input.state)),
        }),
      ];
    }
    case 'preparing':
      return [
        buildPendingAwareHostAction(
          {
            key: 'cancel-preparing',
            label: '取消准备',
            icon: 'close-circle-outline',
            variant: 'secondary',
            testID: TESTIDS.fibCancelPreparingButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.cancelPreparing,
        ),
      ];
    case 'preparationFailed':
      return [
        buildPendingAwareHostAction(
          {
            key: 'retry-preparation',
            label: '重新准备',
            icon: 'refresh-outline',
            variant: 'primary',
            testID: TESTIDS.fibRetryPreparationButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.startRound,
        ),
        buildReturnLobbyAction({
          onPress: input.cancelPreparing,
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
      ];
    case 'ongoing':
      return [
        buildPendingAwareHostAction(
          {
            key: 'guess-seat',
            label: input.isGuessing ? '取消选人' : '大聪明选人',
            icon: 'person-outline',
            variant: input.isGuessing ? 'secondary' : 'primary',
            testID: TESTIDS.fibGuessSeatButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.toggleGuessMode,
        ),
        buildPendingAwareHostAction(
          {
            key: 'reveal-round',
            label: '公布答案',
            icon: 'eye-outline',
            variant: 'primary',
            testID: TESTIDS.fibRevealRoundButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.revealRound,
        ),
        buildPendingAwareHostAction(
          {
            key: 'redraw-round',
            label: '重新抽词',
            icon: 'refresh-outline',
            variant: 'secondary',
            testID: TESTIDS.fibRedrawRoundButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.redrawRound,
        ),
      ];
    case 'ended':
      return [
        buildNextRoundAction({
          onPress: () =>
            showConfirmAlert(
              HOST_FLOW_CONFIRM.nextRoundTitle,
              '重新分配身份，开始新的一局。',
              input.startRound,
            ),
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
        buildReturnLobbyAction({
          onPress: input.endGame,
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
      ];
  }
}

function createFibRoomManagementActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  const actions: RoomHostManagementAction[] = [];
  if (input.capabilities.canConfigureGame.isAllowed) {
    actions.push(
      buildRoomConfigAction({
        onPress: input.capabilities.canConfigureGame.execute,
      }),
    );
  }
  if (input.capabilities.canFillBots.isAllowed) {
    actions.push(
      buildFillBotsAction({
        onPress: input.capabilities.canFillBots.execute,
      }),
    );
  }
  if (input.capabilities.canClearSeats.isAllowed) {
    actions.push(
      buildClearSeatsAction({
        onPress: input.capabilities.canClearSeats.execute,
      }),
    );
  }
  // 分享房间常驻大厅房间区，是座位不满时任务卡的补救。
  if (input.state.phase === 'lobby') {
    actions.push(buildShareRoomAction(input.capabilities.canShareRoom));
  }
  return actions;
}

/**
 * The host's declared task per phase (room-shell-contract "Host Task").
 * Keys reference the sheet actions assembled above.
 */
function createFibHostTask(input: FibHostManagementInput): RoomHostTask | null {
  switch (input.state.phase) {
    case 'lobby':
      return hostStartTask(HOST_ACTION_KEYS.assignRoles);
    case 'viewing': {
      const round = input.state.round;
      if (round === null) return null;
      const participants = getFibViewingParticipants(input.state);
      // The task is the start; until every seat viewed it is blocked by
      // the sheet action's reason, with the bot scaffold as the remedy.
      const hasUnviewedBot = participants.some(
        (participant) => participant.isBot && !round.viewedSeats.includes(participant.seat),
      );
      return hostActionTask(
        HOST_ACTION_KEYS.startGame,
        hasUnviewedBot ? { remedyActionKey: HOST_ACTION_KEYS.markBotsViewed } : {},
      );
    }
    case 'preparing':
      return hostMessageTask('正在准备本轮词语', { actionKey: 'cancel-preparing' });
    case 'preparationFailed':
      // Re-preparation is the recovery path out of a failed state.
      return hostActionTask('retry-preparation');
    case 'ongoing':
      // 大聪明选人中：点座位盘选人，退出走同一个切换动作。
      return input.isGuessing
        ? hostMessageTask('点座位盘选择大聪明猜中的玩家', { actionKey: 'guess-seat' })
        : hostActionTask('reveal-round');
    case 'ended':
      return hostClosingTask();
  }
}

function createFibDangerActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  switch (input.state.phase) {
    case 'viewing':
    case 'ongoing':
      return [
        buildAbortGameAction({
          onPress: input.abandonGame,
          isEnabled: !input.isCommandSubmitting,
          isLoading: input.isCommandSubmitting || undefined,
        }),
      ];
    case 'ended':
    case 'lobby':
    case 'preparing':
    case 'preparationFailed':
      return [];
  }
}

function createFibHostSection(
  key: string,
  title: string,
  actions: readonly RoomHostManagementAction[],
): RoomHostManagementSection | null {
  return actions.length === 0 ? null : { key, title, actions };
}

/** Build the complete FibKing Host-only command surface from current room facts. Host gating belongs to the shell factory. */
export function createFibHostManagement(input: FibHostManagementInput): RoomHostManagementModel {
  const sections = [
    createFibHostSection('current-flow', '当前流程', createFibCurrentFlowActions(input)),
    createFibHostSection('room', '房间管理', createFibRoomManagementActions(input)),
    createFibHostSection('danger', '危险操作', createFibDangerActions(input)),
  ].filter((section): section is RoomHostManagementSection => section !== null);

  if (sections.length === 0) {
    throw new Error('FibKing Host management must expose at least one action');
  }
  return {
    task: createFibHostTask(input),
    sections,
  };
}

function enabledButton(
  key: string,
  label: string,
  audience: RoomBottomButtonAudience,
  variant: RoomBottomButton['variant'],
  testID: string,
  onPress: () => void,
): RoomBottomButton {
  return {
    key,
    label,
    audience,
    variant,
    size: variant === 'primary' ? 'lg' : 'md',
    testID,
    isEnabled: true,
    onPress,
  };
}

interface FibBottomActionsInput {
  readonly state: FibState;
  readonly isHost: boolean;
  /** The effective seat (own or taken-over bot); null for a spectator. */
  readonly viewerSeat: number | null;
  readonly openIdentity: () => void;
}

export function createFibBottomActions(input: FibBottomActionsInput): RoomBottomStackModel {
  const primary: RoomBottomButton[] = [];
  const secondary: RoomBottomButton[] = [];
  const ghost: RoomBottomButton[] = [];

  switch (input.state.phase) {
    case 'lobby':
    case 'preparing':
    case 'preparationFailed':
      break;
    case 'viewing':
    case 'ongoing': {
      // 查看动作定义走共享解析：旁观者看题目、在座玩家看身份，同一命令两种内容，
      // 故受众是 anyone。层级按 2026 规则：查看阶段是 primary，其余阶段是
      // secondary，永不进 ghost。
      const viewIdentityAction = resolveViewIdentityAction({
        isVisible: true,
        label: input.viewerSeat === null ? '查看题目' : VIEW_IDENTITY_LABEL,
        onPress: input.openIdentity,
      });
      if (viewIdentityAction !== null) {
        (input.state.phase === 'viewing' ? primary : secondary).push(
          buildViewIdentityButton(viewIdentityAction, {
            key: 'view-identity',
            variant: input.state.phase === 'viewing' ? 'primary' : 'secondary',
            audience: 'anyone',
            testID: TESTIDS.fibViewIdentityButton,
          }),
        );
      }
      break;
    }
    case 'ended':
      secondary.push(
        enabledButton(
          'view-result',
          '查看结果',
          'anyone',
          'secondary',
          TESTIDS.fibViewResultButton,
          input.openIdentity,
        ),
      );
      break;
  }

  return {
    kind: 'stacked',
    message: input.isHost ? null : getPlayerMessage(input.state, input.viewerSeat),
    progress: null,
    layout: { primary, secondary, ghost },
  };
}

function getPlayerMessage(state: FibState, viewerSeat: number | null): string | null {
  switch (state.phase) {
    case 'lobby':
      return viewerSeat === null ? null : '等待房主分配角色';
    case 'preparing':
      return '房主正在准备本轮';
    case 'preparationFailed':
      return buildPreparationFailureMessage({ reason: '词语准备失败', hostAction: '重新准备' });
    case 'viewing':
      if (viewerSeat === null) return '等待玩家查看身份';
      return state.round.viewedSeats.includes(viewerSeat) ? null : '请先查看你的身份';
    case 'ongoing':
    case 'ended':
      return null;
  }
}

export function getFibRoleName(role: FibRole): string {
  return FIB_ROLE_NAMES[role];
}

/** 瞎掰王板子信息分组：大聪明 1 + 老实人 1 + 瞎掰王 N−2。 */
export function createFibBoardInfoSections(playerCount: number): readonly BoardInfoSection[] {
  return [
    {
      title: getFibRoleName('guesser'),
      items: [{ roleId: 'guesser', displayName: getFibRoleName('guesser'), count: 1 }],
      color: colors.god,
    },
    {
      title: getFibRoleName('honest'),
      items: [{ roleId: 'honest', displayName: getFibRoleName('honest'), count: 1 }],
      color: colors.villager,
    },
    {
      title: getFibRoleName('fibber'),
      items: [{ roleId: 'fibber', displayName: getFibRoleName('fibber'), count: playerCount - 2 }],
      color: colors.wolf,
    },
  ];
}

export interface FibRoomShellModelInput extends Omit<
  RoomShellModelInput,
  'phase' | 'step' | 'isAudioPlaying'
> {
  readonly state: FibState;
}

/** Assembles the FibKing RoomShellModel from the hook's projections. */
export function createFibRoomShellModel(input: FibRoomShellModelInput): RoomShellModel {
  return createRoomShellModel({
    ...input,
    isAudioPlaying: false,
    phase: input.state.phase,
    step: null,
  });
}

/** FibKing-owned derivation of game-neutral RoomShell models. */

import {
  type FibRole,
  type FibState,
  type FibWordDefinition,
  getFibOccupiedSeatCount,
  getFibRole,
  getFibUserSeat,
  getFibViewingParticipants,
  isFibRoomFull,
} from '@game-judge/game-engine/games/fibking/public';

import { confirmAction } from '@/features/room/confirm';
import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
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
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  hostMessageTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import type {
  RoomActionAudience,
  RoomHostAction,
  RoomPlayerAction,
} from '@/features/room/model/RoomAction';
import {
  createRoomSetupCapabilities,
  createShareRoomCapability,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementModel,
  RoomHostTask,
} from '@/features/room/model/RoomHostManagement';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import {
  buildPreparationFailureMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
  VIEW_IDENTITY_LABEL,
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

export const FIB_DISPLAY_NAME = '瞎掰王';

const FIB_ROLE_NAMES: Readonly<Record<FibRole, string>> = {
  guesser: '大聪明',
  honest: '老实人',
  fibber: '瞎掰王',
};

/** The word definition's field labels: the identity card and the review. */
export const FIB_DEFINITION_LABELS: Readonly<Record<keyof FibWordDefinition, string>> = {
  coreMeaning: '核心释义',
  usageNote: '使用提示',
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
  readonly takeOverBots: RoomCapability<readonly [seat: number]>;
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
    canShareRoom: createShareRoomCapability(
      isLobby ||
        input.state.phase === 'preparing' ||
        input.state.phase === 'preparationFailed' ||
        input.state.phase === 'viewing',
      input.shareRoom,
    ),
    canViewProfiles: createViewProfilesCapability(true, input.openProfile),
    canTakeOverBots: input.takeOverBots,
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
  readonly revealRound: () => void;
  readonly redrawRound: () => void;
  readonly restartGame: () => void | Promise<void>;
  /** The review （本局复盘） entry; null until the round ended. */
  readonly review: RoomReviewEntry | null;
}

function buildFibRestartAction(input: FibHostManagementInput): RoomHostAction {
  return buildResetToLobbyAction({
    onPress: () =>
      confirmAction({
        label: '重新开始？',
        body:
          input.state.phase === 'ended'
            ? input.review?.isPending
              ? '你尚未查看本局复盘。重新开始将保留座位、配置和已用词记录，清除本局；之后可能无法查看复盘，本局已结算，奖励不会撤销。'
              : '保留座位、配置和已用词记录，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
            : '保留座位、配置和已用词记录，清除本局并回到准备。本局中止，不结算完成奖励。',
        tone: 'danger',
        confirmText: '重新开始',
        onConfirm: input.restartGame,
      }),
    isEnabled: !input.isCommandSubmitting,
    isLoading: input.isCommandSubmitting || undefined,
  });
}

function createFibCurrentFlowActions(input: FibHostManagementInput): RoomHostAction[] {
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
      const actions: RoomHostAction[] = [
        buildStartGameAction({
          onPress: () =>
            confirmAction({
              label: HOST_FLOW_CONFIRM.startTitle,
              body: allViewedConfirmBody('身份', '将开始本轮描述'),
              onConfirm: input.beginRound,
            }),
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
            onPress: () =>
              confirmAction({
                label: '标记机器人已查看？',
                body: '将标记所有未查看身份的机器人。',
                onConfirm: input.markAllBotsViewed,
              }),
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
            confirmAction({
              label: HOST_FLOW_CONFIRM.assignTitle,
              body: '将为每位玩家分配身份并准备本轮词语',
              onConfirm: input.startRound,
            }),
          isEnabled: !input.isCommandSubmitting && isFibRoomFull(input.state),
          isLoading: input.isCommandSubmitting || undefined,
          disabledReason: input.isCommandSubmitting
            ? null
            : seatShortageReason(input.state.numberOfPlayers, getFibOccupiedSeatCount(input.state)),
        }),
      ];
    }
    case 'preparing':
      return [];
    case 'preparationFailed':
      return [
        buildPendingAwareHostAction(
          {
            key: 'retry-preparation',
            label: '重新准备',
            icon: 'refresh-outline',
            category: 'host',
            testID: TESTIDS.fibRetryPreparationButton,
          },
          input.isCommandSubmitting,
          input.startRound,
        ),
        buildFibRestartAction(input),
      ];
    case 'ongoing':
      return [
        buildPendingAwareHostAction(
          {
            key: 'guess-seat',
            label: input.isGuessing ? '取消选人' : '大聪明选人',
            icon: 'person-outline',
            category: 'host',
            testID: TESTIDS.fibGuessSeatButton,
          },
          input.isCommandSubmitting,
          input.toggleGuessMode,
        ),
        buildPendingAwareHostAction(
          {
            key: 'reveal-round',
            label: '公布答案',
            icon: 'eye-outline',
            category: 'host',
            testID: TESTIDS.fibRevealRoundButton,
          },
          input.isCommandSubmitting,
          input.revealRound,
        ),
        buildPendingAwareHostAction(
          {
            key: 'redraw-round',
            label: '重新抽词',
            icon: 'refresh-outline',
            category: 'host',
            testID: TESTIDS.fibRedrawRoundButton,
          },
          input.isCommandSubmitting,
          input.redrawRound,
        ),
      ];
    case 'ended':
      if (input.review === null) {
        throw new Error('[FAIL-FAST] FibKing ended host has no review entry');
      }
      return [buildReviewHostAction(input.review), buildFibRestartAction(input)];
  }
}

function createFibRoomManagementActions(input: FibHostManagementInput): RoomHostAction[] {
  const actions: RoomHostAction[] = [];
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
  return actions;
}

/**
 * The host's declared task per phase (room-shell-contract "Host Task").
 * Keys reference the sheet actions assembled above.
 */
function createFibHostTask(input: FibHostManagementInput): RoomHostTask | null {
  switch (input.state.phase) {
    case 'lobby':
      return hostActionTask(HOST_ACTION_KEYS.assignRoles);
    case 'viewing': {
      const round = input.state.round;
      if (round === null) return null;
      return hostActionTask(HOST_ACTION_KEYS.startGame);
    }
    case 'preparing':
      return hostMessageTask('正在准备本轮词语', { escapeActionKey: 'restart' });
    case 'preparationFailed':
      // Re-preparation is the recovery path out of a failed state.
      return hostActionTask('retry-preparation');
    case 'ongoing':
      // 大聪明选人中：点座位盘选人，退出走同一个切换动作。
      return input.isGuessing
        ? hostMessageTask('请选择大聪明指认的玩家', { escapeActionKey: 'guess-seat' })
        : hostActionTask('guess-seat');
    case 'ended':
      return { kind: 'choice', actionKeys: [HOST_ACTION_KEYS.review, 'restart'] };
  }
}

function createFibDangerActions(input: FibHostManagementInput): RoomHostAction[] {
  switch (input.state.phase) {
    case 'viewing':
    case 'ongoing':
    case 'preparing':
      return [buildFibRestartAction(input)];
    case 'ended':
    case 'lobby':
    case 'preparationFailed':
      return [];
  }
}

/** Build the complete FibKing Host-only command surface from current room facts. Host gating belongs to the shell factory. */
export function createFibHostManagement(input: FibHostManagementInput): RoomHostManagementModel {
  const actions = [
    ...createFibCurrentFlowActions(input),
    ...createFibRoomManagementActions(input),
    ...createFibDangerActions(input),
  ];

  if (actions.length === 0) {
    throw new Error('FibKing Host management must expose at least one action');
  }
  const { state } = input;
  const hostSeat = getFibUserSeat(state, state.hostUserId);
  const pendingActionKeys =
    state.phase === 'lobby'
      ? [HOST_ACTION_KEYS.assignRoles]
      : state.phase === 'viewing' && state.round !== null
        ? hostSeat !== null && !state.round.viewedSeats.includes(hostSeat)
          ? []
          : [HOST_ACTION_KEYS.startGame]
        : state.phase === 'ended'
          ? input.review?.isPending
            ? [HOST_ACTION_KEYS.review]
            : []
          : state.phase === 'ongoing' && !input.isGuessing
            ? ['guess-seat']
            : [];
  return {
    task: createFibHostTask(input),
    actions,
    pendingActionKeys,
    ...(state.phase === 'preparationFailed' ? { hasPendingDecision: true } : {}),
  };
}

function enabledButton(
  key: string,
  label: string,
  audience: RoomActionAudience,
  testID: string,
  onPress: () => void,
): RoomPlayerAction {
  return {
    key,
    label,
    audience,
    category: 'resource',
    testID,
    state: { kind: 'ready', onPress },
  };
}

interface FibBottomActionsInput {
  readonly state: FibState;
  readonly isHost: boolean;
  /** The effective seat (own or taken-over bot); null for a spectator. */
  readonly viewerSeat: number | null;
  readonly isSubmitting: boolean;
  readonly openIdentity: () => void;
  /** The review （本局复盘） entry; null until the round ended. */
  readonly review: RoomReviewEntry | null;
}

/**
 * The bottom layout: the identity / word view during play, then the
 * public result and the review （本局复盘） for every reader of an ended
 * round.
 */
export function createFibPlayerActions(input: FibBottomActionsInput): RoomPlayerActionModel {
  const primary: RoomPlayerAction[] = [];
  const secondary: RoomPlayerAction[] = [];
  const ghost: RoomPlayerAction[] = [];

  switch (input.state.phase) {
    case 'lobby':
    case 'preparing':
    case 'preparationFailed':
      break;
    case 'viewing':
    case 'ongoing': {
      // 查看动作定义走共享解析：旁观者看题目、在座玩家看身份，同一命令两种内容，
      // 故受众是 anyone.
      const viewIdentityAction = resolveViewIdentityAction({
        isVisible: true,
        label: input.viewerSeat === null ? '查看题目' : VIEW_IDENTITY_LABEL,
        onPress: input.openIdentity,
      });
      if (viewIdentityAction !== null) {
        primary.push(
          buildViewIdentityButton(viewIdentityAction, {
            isSubmitting: input.isSubmitting,
            key: 'view-identity',
            audience: 'anyone',
            testID: TESTIDS.roomViewIdentityButton,
            isPending:
              input.state.phase === 'viewing' &&
              input.viewerSeat !== null &&
              input.state.round !== null &&
              !input.state.round.viewedSeats.includes(input.viewerSeat),
          }),
        );
      }
      break;
    }
    case 'ended':
      if (input.review === null) {
        throw new Error('[FAIL-FAST] FibKing ended round has no review entry');
      }
      secondary.push(
        enabledButton(
          'view-result',
          '查看结果',
          'anyone',
          TESTIDS.fibViewResultButton,
          input.openIdentity,
        ),
        ...buildViewerReviewBottomButtons(input.review, { isHost: input.isHost }),
      );
      break;
  }

  return {
    message: input.isHost ? null : getPlayerMessage(input.state, input.viewerSeat),
    progress: null,
    actions: [...primary, ...secondary, ...ghost],
    group: null,
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
      return state.round.viewedSeats.includes(viewerSeat) ? null : '请点击「查看身份」';
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
      tone: 'god',
    },
    {
      title: getFibRoleName('honest'),
      items: [{ roleId: 'honest', displayName: getFibRoleName('honest'), count: 1 }],
      tone: 'villager',
    },
    {
      title: getFibRoleName('fibber'),
      items: [{ roleId: 'fibber', displayName: getFibRoleName('fibber'), count: playerCount - 2 }],
      tone: 'wolf',
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

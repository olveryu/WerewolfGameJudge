/** FibKing-owned derivation of game-neutral RoomShell models. */

import {
  type FibRole,
  type FibState,
  getFibBotUserId,
  getFibOccupiedSeatCount,
  getFibRole,
  getFibViewingParticipants,
  isFibRoomFull,
} from '@game-judge/game-engine/games/fibking/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import {
  buildRoomHeaderModel,
  type RoomHeaderGachaStatus,
} from '@/features/room/model/buildRoomHeaderModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildPendingAwareHostAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
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
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
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
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type {
  RoomConnectionViewModel,
  RoomControlledSeatModel,
  RoomShellModel,
} from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

export const FIB_DISPLAY_NAME = '瞎掰王';

const FIB_ROLE_NAMES: Readonly<Record<FibRole, string>> = {
  guesser: '大聪明',
  honest: '老实人',
  fibber: '瞎掰王',
};

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

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
    canViewProfiles: allowed(input.openProfile),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, input.takeOverBot),
  };
}

export function getFibProfileTarget(state: FibState, seat: number): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => getFibBotUserId(state.roomCode, botSeat),
    getBotDisplayName,
  );
}

interface FibSeatTapInput {
  readonly state: FibState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project Fib sparse seating into the shared room seat-tap contract. */
export function getFibSeatTapIntent(input: FibSeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getFibProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

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
    botUserId: (seat) => getFibBotUserId(state.roomCode, seat),
    outOfRangeError: (seat) => `Fib seat source index is out of range: ${seat}`,
    lockedSeatReason: '当前阶段座位已锁定',
    resolveSecondaryLabel: (seat, player) =>
      player === null ? null : getSeatRoleLabel(state, seat),
  });
}

interface FibHostManagementInput {
  readonly state: FibState;
  readonly isHost: boolean;
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
      const allViewed = hasEverySeatViewed(input.state);
      const actions: RoomHostManagementAction[] = [
        buildStartGameAction({
          label: '开始游戏',
          onPress: input.beginRound,
          isEnabled: !input.isCommandSubmitting && allViewed,
          isLoading: input.isCommandSubmitting || undefined,
          disabledReason: allViewed ? null : '还有玩家未查看身份',
          isPrimary: true,
          // The panel action submits directly; the console gates the same
          // callback with a confirm.
          onConsolePress: () =>
            showConfirmAlert('开始游戏？', '全员已查看身份，将开始本轮描述', input.beginRound),
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
        buildStartGameAction({
          label: '开始本轮',
          onPress: input.startRound,
          isEnabled: !input.isCommandSubmitting && isFibRoomFull(input.state),
          isLoading: input.isCommandSubmitting || undefined,
          disabledReason: input.isCommandSubmitting
            ? null
            : `座位尚未坐满（还差 ${input.state.numberOfPlayers - getFibOccupiedSeatCount(input.state)} 人）`,
          isPrimary: true,
          remedy: buildShareRoomRemedy(input.capabilities.canShareRoom),
          // The panel action submits directly; the console gates the same
          // callback with a confirm.
          onConsolePress: () =>
            showConfirmAlert('开始本轮？', '将为每位玩家分配身份并准备本轮词语', input.startRound),
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
            // Re-preparation is the recovery path out of a failed state:
            // the console re-presents it directly, with no confirm.
            isPrimary: true,
          },
          input.isCommandSubmitting,
          input.startRound,
        ),
        buildPendingAwareHostAction(
          {
            key: 'return-lobby',
            label: '返回大厅',
            icon: 'return-down-back-outline',
            variant: 'secondary',
            testID: TESTIDS.fibReturnLobbyButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.cancelPreparing,
        ),
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
        buildPendingAwareHostAction(
          {
            key: 'next-round',
            label: '下一轮',
            icon: 'play-forward-outline',
            variant: 'primary',
            testID: TESTIDS.fibNextRoundButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.startRound,
        ),
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
  return actions;
}

function createFibDangerActions(input: FibHostManagementInput): RoomHostManagementAction[] {
  switch (input.state.phase) {
    case 'viewing':
    case 'ongoing':
      return [
        buildPendingAwareHostAction(
          {
            key: 'abandon-game',
            label: '放弃游戏',
            icon: 'stop-circle-outline',
            variant: 'danger',
            testID: TESTIDS.fibAbandonGameButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.abandonGame,
        ),
      ];
    case 'ended':
      return [
        buildPendingAwareHostAction(
          {
            key: 'end-game',
            label: '结束游戏',
            icon: 'stop-circle-outline',
            variant: 'danger',
            testID: TESTIDS.fibEndGameButton,
            isLoading: input.isCommandSubmitting || undefined,
          },
          input.isCommandSubmitting,
          input.endGame,
        ),
      ];
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

function hasEverySeatViewed(state: FibState): boolean {
  if (state.round === null) return false;
  return getFibViewingParticipants(state).every((participant) =>
    state.round.viewedSeats.includes(participant.seat),
  );
}

/** Build the complete FibKing Host-only command surface from current room facts. */
export function createFibHostManagement(
  input: FibHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
  const sections = [
    createFibHostSection('current-flow', '当前流程', createFibCurrentFlowActions(input)),
    createFibHostSection('room-management', '房间管理', createFibRoomManagementActions(input)),
    createFibHostSection('danger', '危险操作', createFibDangerActions(input)),
  ].filter((section): section is RoomHostManagementSection => section !== null);

  if (sections.length === 0) {
    throw new Error('FibKing Host management must expose at least one action');
  }
  return {
    sections,
  };
}

function enabledButton(
  key: string,
  label: string,
  variant: RoomBottomButton['variant'],
  testID: string,
  onPress: () => void,
): RoomBottomButton {
  return {
    key,
    label,
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
      // 查看动作定义走共享解析：旁观者看题目、在座玩家看身份，同一命令两种内容。
      const viewIdentityAction = resolveViewIdentityAction({
        isVisible: true,
        label: input.viewerSeat === null ? '查看题目' : VIEW_IDENTITY_LABEL,
        onPress: input.openIdentity,
      });
      if (viewIdentityAction !== null) {
        secondary.push(
          buildViewIdentityButton(viewIdentityAction, {
            key: 'view-identity',
            variant: 'secondary',
            size: 'md',
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
      return viewerSeat === null ? null : '等待房主开始本轮';
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

export interface FibRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: FibState;
  readonly seatSource: RoomSeatDataSource;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly bottomActions: RoomBottomActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly controlledSeat: RoomControlledSeatModel | null;
}

/** Assembles the FibKing RoomShellModel from the hook's projections. */
export function createFibRoomShellModel(input: FibRoomShellModelInput): RoomShellModel {
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: input.state.phase,
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
      source: input.seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions: input.bottomActions,
    hostManagement: input.hostManagement,
    controlledSeat: input.controlledSeat,
  };
}

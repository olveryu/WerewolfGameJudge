/** Werewolf-owned derivation of neutral room-shell models. */

import type { SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { buildNightPlan } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayAs } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleSpec } from '@game-judge/game-engine/games/werewolf/public';

import type { BoardInfoSection, RoleDisplayItem } from '@/features/room/model/BoardInfoSection';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { type NightStepProgress, resolveStepProgress } from '@/features/room/model/nightProgress';
import type {
  RoomBottomActionLayout,
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type {
  RoomSeatDataSource,
  RoomSeatStatusBadge,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { createWerewolfHostManagement } from '@/games/werewolf/room/createWerewolfHostManagement';
import type {
  BottomLayout,
  ButtonBehavior,
  ButtonConfig,
  StaticButtonAction,
} from '@/games/werewolf/room/hooks/bottomLayoutConfig';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { ActionIntent, HostControlEvent } from '@/games/werewolf/room/policy/types';
import { createSheriffElectionDockModel } from '@/games/werewolf/room/sheriffElectionDockModel';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import type { SeatViewModel } from '@/games/werewolf/room/werewolfRoom.helpers';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { colors } from '@/theme';

export const WEREWOLF_DISPLAY_NAME = '狼人杀';

const denied = <TArgs extends readonly unknown[], TResult>(
  reason: string | null,
): RoomCapability<TArgs, TResult> => ({ isAllowed: false, reason });

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

interface WerewolfCapabilitiesInput {
  readonly status: GameStatus;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly hasOccupiedSeats: boolean;
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

export function createWerewolfRoomCapabilities(input: WerewolfCapabilitiesInput): RoomCapabilities {
  const isSetup = input.status === GameStatus.Unseated || input.status === GameStatus.Seated;
  // Takeover follows the unified rule: the host may take over a bot seat at
  // any time, with no phase, debug-mode, or audio conditions.
  const canTakeOver = input.isHost;
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup,
    isHost: input.isHost,
    supportsBots: true,
    mySeat: input.mySeat,
    hasOccupiedSeats: input.hasOccupiedSeats,
    isRoomFull: input.status === GameStatus.Seated,
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
    canViewProfiles:
      input.status !== GameStatus.Ongoing && input.status !== GameStatus.Day
        ? allowed(input.openProfile)
        : denied('游戏进行中不能查看玩家资料'),
    canTakeOverBots: createBotTakeoverCapability(canTakeOver, input.takeOverBot),
  };
}

interface WerewolfSeatSourceInput {
  readonly seats: readonly SeatViewModel[];
  readonly controlledSeat: number | null;
  readonly showBotRoles: boolean;
  readonly showLevels: boolean;
  readonly decorationsEnabled: boolean;
  readonly sheriffElectionView: SheriffElectionViewModel | null;
  readonly revision: string | number;
}

function getSheriffSeatStatusBadge(
  view: SheriffElectionViewModel | null,
  seat: number,
): RoomSeatStatusBadge | null {
  if (view === null) return null;
  if (view.finalResult?.kind === 'elected' && view.finalResult.sheriffSeat === seat) {
    return { label: '警长', tone: 'warning' };
  }

  const records = view.candidateRecords;
  if (records === null) return null;
  if (records.withdrawnSeats.includes(seat)) return { label: '退水', tone: 'muted' };
  if (!records.activeCandidateSeats.includes(seat)) return null;
  return view.phase === 'runoffSpeech' || view.phase === 'runoffVote'
    ? { label: 'PK', tone: 'warning' }
    : { label: '上警', tone: 'primary' };
}

export function createWerewolfSeatDataSource(input: WerewolfSeatSourceInput): RoomSeatDataSource {
  return {
    count: input.seats.length,
    revision: input.revision,
    getSeat(index): RoomSeatViewModel {
      const seat = input.seats[index];
      if (!seat || seat.seat !== index) {
        throw new Error(`Werewolf seat source is not contiguous at index ${index}`);
      }

      const isControlled = input.controlledSeat === seat.seat;
      const highlight = isControlled
        ? 'controlled'
        : seat.isSelected
          ? 'selected'
          : seat.isWolf
            ? 'danger'
            : 'none';
      const role = seat.player?.role;
      const sheriffStatusBadge = getSheriffSeatStatusBadge(input.sheriffElectionView, seat.seat);

      return {
        seat: seat.seat,
        player: seat.player
          ? toRoomSeatPlayer({
              kind: seat.player.isBot ? 'bot' : 'human',
              userId: seat.player.userId,
              displayName: seat.player.displayName,
              avatarUrl: seat.player.avatarUrl,
              avatarFrame: seat.player.avatarFrame,
              seatFlair: seat.player.seatFlair,
              seatAnimation: seat.player.seatAnimation,
              nameStyle: seat.player.nameStyle,
              revealEffect: seat.player.roleRevealEffect,
              level: seat.player.level,
            })
          : null,
        isSelf: seat.isMySpot,
        highlight,
        secondaryLabel:
          input.showBotRoles && seat.player?.isBot && role ? getRoleDisplayName(role) : null,
        disabledReason: seat.disabledReason,
        showReadyBadge: seat.showReadyBadge === true,
        statusBadge:
          sheriffStatusBadge ??
          (seat.wolfVoteBadge === undefined ? null : { label: seat.wolfVoteBadge, tone: 'danger' }),
        isStatusEmphasized: false,
        showLevel: input.showLevels,
        decorationsEnabled: input.decorationsEnabled,
      };
    },
  };
}

interface WerewolfNightProgress {
  readonly current: number;
  readonly total: number;
  readonly roleName?: string;
}

/** Werewolf's own per-step label: displayAs override + seer label prefix. */
function resolveWerewolfStepRoleName(
  step: ReturnType<typeof buildNightPlan>['steps'][number],
  seerLabelMap: LocalGameState['seerLabelMap'],
): string {
  let roleName = step.displayName;
  const displayAs = getRoleDisplayAs(step.roleId);
  if (displayAs) {
    const displaySpec = getRoleSpec(displayAs);
    roleName = displaySpec?.displayName ?? roleName;
  }
  if (seerLabelMap) {
    const label = seerLabelMap[step.roleId];
    if (label != null && roleName) {
      roleName = `${label}号${roleName}`;
    }
  }
  return roleName;
}

/**
 * Pure night-progress derivation over the local state (the former
 * useNightProgress hook body, moved into the factory so the bottom
 * progress row takes raw room facts like the other six games'
 * factories). The step math is the shared resolveStepProgress; only
 * the step list (night plan) and the label resolution stay werewolf's
 * own.
 */
function deriveWerewolfNightProgress(
  currentStepId: SchemaId | null,
  gameState: LocalGameState,
): WerewolfNightProgress | null {
  if (!currentStepId || gameState.status !== GameStatus.Ongoing) {
    return null;
  }
  const nightPlan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
  const labels: Partial<Record<SchemaId, string>> = {};
  for (const step of nightPlan.steps) {
    labels[step.stepId] = resolveWerewolfStepRoleName(step, gameState.seerLabelMap);
  }
  const progress = resolveStepProgress(
    nightPlan.steps.map((step) => step.stepId),
    currentStepId,
    labels,
  );
  if (progress === null) return null;
  return { current: progress.current, total: progress.total, roleName: progress.label };
}

/** Night step progress for the bottom action panel's slim progress row. */
export function deriveWerewolfBottomProgress(
  currentStepId: SchemaId | null,
  gameState: LocalGameState,
): NightStepProgress | null {
  const nightProgress = deriveWerewolfNightProgress(currentStepId, gameState);
  if (nightProgress === null) return null;
  return {
    current: nightProgress.current,
    total: nightProgress.total,
    label: nightProgress.roleName ?? '',
  };
}

export function createWerewolfBottomActionLayout(input: {
  readonly layout: BottomLayout;
  readonly isActionSubmitting: boolean;
  readonly onIntent: (intent: ActionIntent) => void;
  readonly onStaticAction: (action: StaticButtonAction) => void;
}): RoomBottomActionLayout {
  const executeBehavior = (behavior: ButtonBehavior): void => {
    switch (behavior.kind) {
      case 'intent':
        input.onIntent(behavior.intent);
        return;
      case 'static':
        input.onStaticAction(behavior.action);
        return;
    }
  };

  const mapButton = (button: ButtonConfig): RoomBottomButton => {
    const base = {
      key: button.key,
      label: button.label,
      variant: button.variant,
      size: button.size,
      testID: button.testID,
    } as const;

    if (button.isEnabled && input.isActionSubmitting && button.behavior.kind === 'intent') {
      return {
        ...base,
        isEnabled: false,
        disabledReason: '行动正在确认中',
      };
    }

    if (button.isEnabled) {
      return {
        ...base,
        isEnabled: true,
        onPress: () => executeBehavior(button.behavior),
      };
    }

    return {
      ...base,
      isEnabled: false,
      disabledReason: button.disabledReason,
    };
  };

  return {
    primary: input.layout.primary.map(mapButton),
    secondary: input.layout.secondary.map(mapButton),
    ghost: input.layout.ghost.map(mapButton),
  };
}

// ─── Whole-shell assembly ────────────────────────────────────────────────────

/**
 * Raw room facts and callbacks the Screen supplies for shell assembly.
 * Everything derivable from these facts is derived inside
 * createWerewolfRoomShellModel; the Screen only wires this input object.
 */
export interface WerewolfRoomShellModelInput {
  // Shell pass-through models assembled elsewhere (header-adjacent state).
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly connection: RoomConnectionViewModel;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  // Header.
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly ticketCount: number | null;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly onAvatarPress: () => void;
  // Room facts.
  readonly roomStatus: GameStatus;
  readonly isHost: boolean;
  readonly isAudioPlaying: boolean;
  readonly isActionSubmitting: boolean;
  readonly isStartingGame: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly imActioner: boolean;
  readonly isPlagueMode: boolean;
  readonly seatedCount: number;
  readonly viewedCount: number;
  readonly totalSeats: number;
  readonly actionMessage: string | null;
  /** Non-host phase hint; the bottom action message is its single home. Null for the host. */
  readonly guideMessage: string | null;
  readonly currentStepId: SchemaId | null;
  readonly gameState: LocalGameState;
  // Seats and takeover.
  readonly seatViewModels: readonly SeatViewModel[];
  readonly controlledSeat: number | null;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly stateRevision: string | number;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onSeatLongPressed: (seat: number) => void;
  readonly hasBots: boolean;
  readonly controlledBotName: string | null;
  readonly onReleaseBot: () => void;
  // Host management.
  readonly mvpSeat: number | null;
  readonly onSelectMvp: () => void;
  readonly currentSchemaKind: string | null;
  readonly onHostControl: (action: HostControlEvent['action']) => void;
  readonly onMusicSettings: () => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onNightReview: () => void;
  readonly onLastNightInfo: () => void;
  // Bottom actions.
  readonly bottomLayout: BottomLayout;
  readonly onSchemaButtonPress: (intent: ActionIntent) => void;
  readonly onStaticButtonPress: (action: StaticButtonAction) => void;
  readonly isSheriffInspectorVisible: boolean;
  readonly openSheriffDetails: () => void;
}

/**
 * Assemble the complete RoomShellModel from raw room facts.
 *
 * Single assembly point for the werewolf room shell: host management, seat
 * data source, controlled-seat banner, and the three-way bottom-action
 * branch (sheriff dock / ended info / stacked) all derive here so the
 * Screen cannot drift from the factories' contracts.
 */
export function createWerewolfRoomShellModel(input: WerewolfRoomShellModelInput): RoomShellModel {
  const hostManagement = createWerewolfHostManagement({
    isHost: input.isHost,
    roomStatus: input.roomStatus,
    isPlagueMode: input.isPlagueMode,
    seatedCount: input.seatedCount,
    viewedCount: input.viewedCount,
    totalSeats: input.totalSeats,
    isAudioPlaying: input.isAudioPlaying,
    isStartingGame: input.isStartingGame,
    isHostActionSubmitting: input.isHostActionSubmitting,
    mvpSeat: input.mvpSeat,
    onSelectMvp: input.onSelectMvp,
    // AU-17: scaffold actions key off bot existence. The mark action
    // additionally requires an unviewed bot seat, matching the other
    // games: once every bot is marked there is nothing left to mark.
    canMarkAllBotsViewed:
      input.hasBots &&
      input.roomStatus === GameStatus.Assigned &&
      Array.from(input.gameState.players.values()).some(
        (player) => player?.isBot === true && !player.hasViewedRole,
      ),
    canMarkAllBotsGroupConfirmed:
      input.hasBots &&
      !input.isAudioPlaying &&
      input.roomStatus === GameStatus.Ongoing &&
      input.currentSchemaKind === 'groupConfirm',
    capabilities: input.capabilities,
    sheriffElection: input.sheriffElectionPanel,
    onHostControl: input.onHostControl,
    onMusicSettings: input.onMusicSettings,
    onMarkAllBotsViewed: input.onMarkAllBotsViewed,
    onMarkAllBotsGroupConfirmed: input.onMarkAllBotsGroupConfirmed,
    onNightReview: input.onNightReview,
    onLastNightInfo: input.onLastNightInfo,
  });

  const seatSource = createWerewolfSeatDataSource({
    seats: input.seatViewModels,
    controlledSeat: input.controlledSeat,
    showBotRoles: input.hasBots && input.isHost,
    showLevels: input.roomStatus !== GameStatus.Ongoing && input.roomStatus !== GameStatus.Day,
    decorationsEnabled:
      input.roomStatus !== GameStatus.Ongoing && input.roomStatus !== GameStatus.Day,
    sheriffElectionView: input.sheriffElectionPanel?.view ?? null,
    revision: input.stateRevision,
  });

  const controlledSeatModel = createControlledSeatModel({
    controlledSeat: input.controlledSeat,
    controlledBotName: input.controlledBotName,
    release: input.onReleaseBot,
    gameName: 'Werewolf',
  });

  const roomBottomActionLayout = createWerewolfBottomActionLayout({
    layout: input.bottomLayout,
    isActionSubmitting: input.isActionSubmitting,
    onIntent: input.onSchemaButtonPress,
    onStaticAction: input.onStaticButtonPress,
  });

  const bottomActions = createWerewolfBottomActions(input, roomBottomActionLayout);

  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: input.roomStatus,
    header: {
      onBack: input.onBack,
      onTitlePress: input.onTitlePress,
      onTitleLongPress: input.onTitleLongPress,
      userAction: {
        user: input.user,
        ticketCount: input.ticketCount,
        onPress: input.onAvatarPress,
      },
    },
    connection: input.connection,
    seats: {
      source: seatSource,
      visuallyDisabled:
        (input.roomStatus === GameStatus.Ongoing && input.isAudioPlaying) ||
        input.isActionSubmitting,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.capabilities.canTakeOverBots.isAllowed
        ? input.onSeatLongPressed
        : null,
    },
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions,
    hostManagement,
    controlledSeat: controlledSeatModel,
  };
}

function createWerewolfBottomActions(
  input: WerewolfRoomShellModelInput,
  roomBottomActionLayout: RoomBottomActionLayout,
): RoomBottomActionModel {
  if (input.roomStatus === GameStatus.Day && input.sheriffElectionPanel !== null) {
    return createSheriffElectionDockModel({
      election: input.sheriffElectionPanel,
      roomTools: roomBottomActionLayout,
      isInspectorVisible: input.isSheriffInspectorVisible,
      openDetails: input.openSheriffDetails,
    });
  }

  if (input.roomStatus === GameStatus.Ended) {
    return {
      kind: 'info',
      // The live actionMessage is '' (not null) once no action role remains,
      // so the guide fallback must skip empty strings, not just nullish ones.
      message:
        input.actionMessage !== null && input.actionMessage.length > 0
          ? input.actionMessage
          : input.guideMessage,
      progress: null,
      actions: [
        ...roomBottomActionLayout.primary,
        ...roomBottomActionLayout.secondary,
        ...roomBottomActionLayout.ghost,
      ],
    };
  }

  return {
    kind: 'stacked',
    message:
      !input.isAudioPlaying &&
      (input.imActioner ||
        (input.isPlagueMode && input.isHost && input.roomStatus === GameStatus.Ready))
        ? input.isPlagueMode && input.isHost && input.roomStatus === GameStatus.Ready
          ? '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程'
          : input.actionMessage
        : input.guideMessage,
    progress: deriveWerewolfBottomProgress(input.currentStepId, input.gameState),
    layout: roomBottomActionLayout,
  };
}

export interface WerewolfBoardInfoSectionsInput {
  readonly wolfRoleItems: readonly RoleDisplayItem[];
  readonly godRoleItems: readonly RoleDisplayItem[];
  readonly specialRoleItems: readonly RoleDisplayItem[];
  readonly villagerRoleItems: readonly RoleDisplayItem[];
  readonly villagerCount: number;
}

/**
 * 狼人杀板子信息分组：狼人 / 神职 / 特殊 / 村民。
 * 村民组在有普通村民时把「村民 ×N」置于村民类角色之前。
 */
export function createWerewolfBoardInfoSections(
  input: WerewolfBoardInfoSectionsInput,
): readonly BoardInfoSection[] {
  return [
    { title: '狼人', items: input.wolfRoleItems, color: colors.wolf },
    { title: '神职', items: input.godRoleItems, color: colors.god },
    { title: '特殊', items: input.specialRoleItems, color: colors.third },
    {
      title: '村民',
      items:
        input.villagerCount > 0
          ? [
              { roleId: 'villager', displayName: '村民', count: input.villagerCount },
              ...input.villagerRoleItems,
            ]
          : input.villagerRoleItems,
      color: colors.villager,
    },
  ];
}

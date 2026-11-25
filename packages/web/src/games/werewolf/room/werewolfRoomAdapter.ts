/**
 * werewolfRoomAdapter — Werewolf's projections onto the shared room shell.
 *
 * Every function here is a pure mapping from the authoritative facts
 * (GameState, the viewer-cropped WerewolfViewModel, the night
 * interaction model) plus a few UI states into the shared room
 * contracts: capabilities, seat data source, player actions, board
 * info, and the shell model. No game rule is derived here — the engine
 * projected them; this file only decides presentation.
 */

import type {
  GameState,
  RoleId,
  SchemaId,
  WerewolfDaytimeAnnouncement,
  WerewolfPersonalDaytimeView,
  WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  buildNightPlan,
  Faction,
  GameStatus,
  getPlayerCount,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
} from '@game-judge/game-engine/games/werewolf/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';

import { isAudioPlaybackLocked } from '@/features/room/model/audioPlaybackLock';
import type { BoardInfoSection, RoleDisplayItem } from '@/features/room/model/BoardInfoSection';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { type NightStepProgress, resolveStepProgress } from '@/features/room/model/nightProgress';
import type { RoomPlayerAction, RoomPlayerActionGroup } from '@/features/room/model/RoomAction';
import {
  createRoomSetupCapabilities,
  createShareRoomCapability,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import {
  buildStepActorWaitingMessage,
  buildViewIdentityButton,
  type RoomPlayerActionModel,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomPlayerActions';
import type {
  RoomSeatDataSource,
  RoomSeatStatusBadge,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { resolveRoomViewerAudience } from '@/features/room/model/RoomViewer';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import {
  buildReviewBottomButton,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import type { StepInteraction } from '@/features/room/steps/useStepInteraction';
import { TESTIDS } from '@/testids';

import {
  createWerewolfHostManagement,
  type WerewolfHostControlAction,
} from './createWerewolfHostManagement';
import type { PanelFlowProgress } from './day/panelFlow';
import { createSheriffElectionPlayerActions } from './day/sheriffElectionPlayerActions';
import type { SheriffElectionViewModel } from './day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from './day/useSheriffElection';

export const WEREWOLF_DISPLAY_NAME = '狼人杀';

// =============================================================================
// Capabilities
// =============================================================================

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
  readonly takeOverBots: RoomCapability<readonly [seat: number]>;
  readonly shareRoom: () => void;
}

/** Setup is the pre-deal lobby; profiles close during the night and the day. */
export function isWerewolfSetup(status: GameStatus): boolean {
  return status === GameStatus.Unseated || status === GameStatus.Seated;
}

export function createWerewolfRoomCapabilities(input: WerewolfCapabilitiesInput): RoomCapabilities {
  const setupCapabilities = createRoomSetupCapabilities({
    isSetup: isWerewolfSetup(input.status),
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
    canShareRoom: createShareRoomCapability(
      isWerewolfSetup(input.status) ||
        input.status === GameStatus.Assigned ||
        input.status === GameStatus.Ready,
      input.shareRoom,
    ),
    canViewProfiles: createViewProfilesCapability(
      input.status !== GameStatus.Ongoing && input.status !== GameStatus.Day,
      input.openProfile,
    ),
    canTakeOverBots: input.takeOverBots,
  };
}

// =============================================================================
// Seat data source
// =============================================================================

interface WerewolfSeatSourceInput {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly controlledSeat: number | null;
  readonly sheriffElectionView: SheriffElectionViewModel | null;
  readonly revision: string | number;
  readonly seatSelection?: WerewolfSeatSelection | null;
}

type WerewolfSeatSelection = NonNullable<StepInteraction['seatSelection']>;

function selectedSeats(selection: WerewolfSeatSelection | null | undefined): readonly number[] {
  return selection?.selected ?? [];
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
  const { state, viewModel, controlledSeat } = input;
  const status = viewModel.status;
  const seatCount = viewModel.template.numberOfPlayers;
  const seatViews = new Map(viewModel.seats.map((seat) => [seat.seat, seat]));
  const selection = input.seatSelection;
  const selected = new Set(selectedSeats(selection));
  const showReadyBadges = status === GameStatus.Assigned || status === GameStatus.Ready;
  const showLevelsAndDecorations = status !== GameStatus.Ongoing && status !== GameStatus.Day;

  return {
    count: seatCount,
    revision: input.revision,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= seatCount) {
        throw new Error(`Werewolf seat out of range: ${seat}`);
      }
      const occupant = state.roster[seat];
      const seatView = seatViews.get(seat) ?? null;
      if ((occupant == null) !== (seatView === null)) {
        throw new Error(`[FAIL-FAST] Werewolf seat ${seat} roster and projection disagree`);
      }
      const player =
        occupant == null || seatView === null
          ? null
          : isBotOccupant(occupant)
            ? toRoomSeatPlayer({
                occupant: { kind: 'bot', seat },
                displayName: getBotDisplayName(seat),
              })
            : toRoomSeatPlayer({
                occupant: { kind: 'human', userId: occupant.userId },
                ...occupant.profile,
              });
      const isWolfPeer = seatView?.isWolfPackPeer ?? false;
      const stepStatus = viewModel.stepSeatStatuses[seat];
      const hasReadyBadge =
        (showReadyBadges && player !== null && (seatView?.hasViewedRole ?? false)) ||
        stepStatus?.kind === 'ready';
      const isSelected = selected.has(seat);
      const isEligible = selection?.eligible.includes(seat) ?? false;
      return {
        seat,
        player,
        isSelf: seat === viewModel.mySeat,
        highlight: controlledSeat === seat ? 'controlled' : isWolfPeer ? 'danger' : 'none',
        secondaryLabel:
          seatView !== null && seatView.isBot && seatView.visibleRole !== null
            ? getRoleDisplayName(seatView.visibleRole)
            : null,
        disabledReason:
          selection != null && !isEligible
            ? (selection.unavailableReasons[seat] ?? '此座位当前不可选择')
            : (seatView?.disabledReason ?? undefined),
        showReadyBadge: hasReadyBadge,
        statusBadge:
          getSheriffSeatStatusBadge(input.sheriffElectionView, seat) ??
          (stepStatus?.kind === 'vote' ? { label: stepStatus.label, tone: 'danger' } : null),
        isSelectionUnavailable: selection != null && !isEligible,
        indicators:
          isSelected || isEligible
            ? {
                markers: [],
                progressLabel: null,
                selection: isSelected
                  ? { kind: 'selected', label: null }
                  : { kind: 'available', label: null },
              }
            : null,
        isStatusEmphasized: false,
        showLevel: isWerewolfSetup(status),
        decorationsEnabled: showLevelsAndDecorations,
      };
    },
  };
}

// =============================================================================
// Night progress
// =============================================================================

function resolveStepRoleName(
  step: ReturnType<typeof buildNightPlan>['steps'][number],
  seerLabelMap: GameState['seerLabelMap'],
): string {
  let roleName = step.displayName;
  const displayAs = getRoleDisplayAs(step.roleId);
  if (displayAs) roleName = getRoleSpec(displayAs)?.displayName ?? roleName;
  const label = seerLabelMap?.[step.roleId];
  return label === undefined ? roleName : `${label}号${roleName}`;
}

/** The night progress bar: only while a step is live. */
export function deriveWerewolfBottomProgress(state: GameState): NightStepProgress | null {
  if (state.status !== GameStatus.Ongoing || state.nightStep?.kind !== 'inStep') return null;
  const plan = buildNightPlan(state.templateRoles, state.seerLabelMap);
  const labels: Partial<Record<SchemaId, string>> = {};
  for (const step of plan.steps)
    labels[step.stepId] = resolveStepRoleName(step, state.seerLabelMap);
  const progress = resolveStepProgress(
    plan.steps.map((step) => step.stepId),
    state.nightStep.stepId,
    labels,
  );
  return progress === null
    ? null
    : { current: progress.current, total: progress.total, label: progress.label };
}

// =============================================================================
// Bottom actions
// =============================================================================

interface WerewolfPlayerActionList {
  readonly actions: readonly RoomPlayerAction[];
  readonly group: RoomPlayerActionGroup | null;
}

const EMPTY_ACTIONS: WerewolfPlayerActionList = { actions: [], group: null };

/** Adapt the generic step interaction to the existing room action surface. */
export function createWerewolfStepActionList(input: {
  readonly viewModel: WerewolfViewModel;
  readonly step: StepInteraction;
  readonly isHost: boolean;
  readonly effectiveSeat: number | null;
  readonly isAudioPlaying: boolean;
  readonly review: RoomReviewEntry | null;
  readonly onViewRole: () => void;
  readonly onPersonalView: (view: WerewolfPersonalDaytimeView) => void;
}): WerewolfPlayerActionList {
  const { viewModel, step, effectiveSeat } = input;
  const roleAction =
    effectiveSeat === null
      ? []
      : [
          buildViewIdentityButton(
            { label: VIEW_IDENTITY_LABEL, onPress: input.onViewRole },
            {
              key: 'viewRole',
              audience: 'participant',
              testID: TESTIDS.roomViewIdentityButton,
              isSubmitting: false,
              isPending:
                viewModel.status === GameStatus.Assigned &&
                !viewModel.viewedSeats.includes(effectiveSeat),
            },
          ),
        ];
  switch (viewModel.status) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
      return EMPTY_ACTIONS;
    case GameStatus.Assigned:
    case GameStatus.Ready:
      return { actions: roleAction, group: null };
    case GameStatus.Ongoing:
      if (isAudioPlaybackLocked(input.isAudioPlaying)) return EMPTY_ACTIONS;
      if (step.seatSelection !== null) return { actions: step.actions, group: null };
      if (step.actions.length <= 1) {
        return {
          actions: [
            ...step.actions.map((action) => ({ ...action, isPending: true })),
            ...roleAction,
          ],
          group: null,
        };
      }
      return {
        actions: roleAction,
        group: {
          key: `${viewModel.step?.stepId ?? 'inactive'}:${viewModel.step?.serial ?? 0}`,
          label: viewModel.step?.title ?? '本步行动',
          icon: 'sparkles-outline',
          audience: 'participant',
          isPending:
            effectiveSeat === null || viewModel.stepSeatStatuses[effectiveSeat]?.kind !== 'vote',
          testID: TESTIDS.werewolfNightButton('openActionGroup'),
          backTestID: TESTIDS.werewolfNightButton('closeActionGroup'),
          actions: step.actions,
        },
      };
    case GameStatus.Day:
    case GameStatus.Ended: {
      if (isAudioPlaybackLocked(input.isAudioPlaying)) return EMPTY_ACTIONS;
      if (input.review === null) {
        throw new Error(`[FAIL-FAST] Werewolf ${viewModel.status} has no review entry`);
      }
      const audience = resolveRoomViewerAudience({ isHost: input.isHost, seat: effectiveSeat });
      if (audience === 'spectator') {
        return { actions: [buildReviewBottomButton(input.review)], group: null };
      }
      return {
        actions: [
          ...roleAction,
          ...viewModel.personalDaytimeViews.map((view) =>
            buildViewIdentityButton(
              { label: view.label, onPress: () => input.onPersonalView(view) },
              {
                key: `personalDaytimeView:${view.key}`,
                audience: 'participant',
                testID: TESTIDS.personalDaytimeViewButton(view.key),
                isSubmitting: false,
              },
            ),
          ),
          ...(audience === 'seated' ? [buildReviewBottomButton(input.review)] : []),
        ],
        group: null,
      };
    }
  }
}

interface WerewolfPlayerActionsInput {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly isHost: boolean;
  readonly isAudioPlaying: boolean;
  readonly actions: WerewolfPlayerActionList;
  /** The actioner's bottom message (prompt + status lines); null for non-actioners. */
  readonly actionMessage: string | null;
  /** The wolf settle countdown line, shown while audio playback locks the bottom message; null otherwise. */
  readonly nightStatusLine: string | null;
  readonly isStepActor: boolean;
  readonly guideMessage: string | null;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly openSheriffDetails: () => void;
}

export function createWerewolfPlayerActions(
  input: WerewolfPlayerActionsInput,
): RoomPlayerActionModel {
  const { state, viewModel, actions } = input;
  if (viewModel.status === GameStatus.Day && input.sheriffElectionPanel !== null) {
    return createSheriffElectionPlayerActions({
      election: input.sheriffElectionPanel,
      roomTools: actions.actions,
      isHost: input.isHost,
      isAudioPlaying: input.isAudioPlaying,
      openDetails: input.openSheriffDetails,
    });
  }
  if (viewModel.status === GameStatus.Ended) {
    return { message: input.guideMessage, progress: null, actions: actions.actions, group: null };
  }
  const progress = deriveWerewolfBottomProgress(state);
  const isActioner = viewModel.status === GameStatus.Ongoing && input.isStepActor;
  const waiting =
    viewModel.status === GameStatus.Ongoing && !isActioner
      ? buildStepActorWaitingMessage(progress)
      : null;
  return {
    message: isAudioPlaybackLocked(input.isAudioPlaying)
      ? input.nightStatusLine
      : isActioner
        ? input.actionMessage
        : (waiting ?? input.guideMessage),
    progress,
    actions: actions.actions,
    group: actions.group,
  };
}

// =============================================================================
// Board info
// =============================================================================

interface RoleItems {
  readonly wolf: RoleDisplayItem[];
  readonly god: RoleDisplayItem[];
  readonly special: RoleDisplayItem[];
  readonly villager: RoleDisplayItem[];
  readonly villagerCount: number;
}

function groupRoleItems(roles: readonly RoleId[]): RoleItems {
  const buckets = {
    wolf: new Map<RoleId, RoleDisplayItem>(),
    god: new Map<RoleId, RoleDisplayItem>(),
    special: new Map<RoleId, RoleDisplayItem>(),
    villager: new Map<RoleId, RoleDisplayItem>(),
  };
  let villagerCount = 0;
  for (const role of roles) {
    if (role === 'villager') {
      villagerCount += 1;
      continue;
    }
    const spec = getRoleSpec(role);
    if (spec === undefined) throw new Error(`[FAIL-FAST] Unknown role in template: ${role}`);
    const bucket =
      spec.faction === Faction.Wolf
        ? buckets.wolf
        : spec.faction === Faction.God
          ? buckets.god
          : spec.faction === Faction.Special
            ? buckets.special
            : buckets.villager;
    const existing = bucket.get(role);
    bucket.set(
      role,
      existing
        ? { ...existing, count: existing.count + 1 }
        : { roleId: role, displayName: spec.displayName, count: 1 },
    );
  }
  return {
    wolf: [...buckets.wolf.values()],
    god: [...buckets.god.values()],
    special: [...buckets.special.values()],
    villager: [...buckets.villager.values()],
    villagerCount,
  };
}

/** The board card's four faction sections; plain villagers collapse to one counted item. */
export function createWerewolfBoardInfoSections(
  roles: readonly RoleId[],
): readonly BoardInfoSection[] {
  const items = groupRoleItems(roles);
  return [
    { title: '狼人', items: items.wolf, color: 'var(--color-wolf)' },
    { title: '神职', items: items.god, color: 'var(--color-god)' },
    { title: '特殊', items: items.special, color: 'var(--color-third)' },
    {
      title: '村民',
      items:
        items.villagerCount > 0
          ? [
              { roleId: 'villager', displayName: '村民', count: items.villagerCount },
              ...items.villager,
            ]
          : items.villager,
      color: 'var(--color-villager)',
    },
  ];
}

// =============================================================================
// Shell model
// =============================================================================

interface WerewolfRoomShellModelInput extends Pick<
  RoomShellModelInput,
  | 'roomCode'
  | 'viewer'
  | 'capabilities'
  | 'connection'
  | 'seatConfirmation'
  | 'profile'
  | 'share'
  | 'onSeatPress'
  | 'onBack'
  | 'onTitlePress'
  | 'onTitleLongPress'
  | 'user'
  | 'gachaStatus'
  | 'onUserActionPress'
> {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly seatSelection?: WerewolfSeatSelection | null;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly onReleaseBot: () => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly isActionSubmitting: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly playerActions: RoomPlayerActionModel;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly panelFlow: PanelFlowProgress;
  readonly onHostControl: (action: WerewolfHostControlAction) => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onMusicSettings: () => void;
  readonly review: RoomReviewEntry | null;
  readonly onGrantReviewAccess: () => void;
  readonly onLastNightInfo: () => void;
  readonly onLastNightDeaths: () => void;
  readonly announcements: readonly WerewolfDaytimeAnnouncement[];
  readonly onAnnouncement: (announcement: WerewolfDaytimeAnnouncement) => void;
  readonly onSelectMvp: () => void;
}

/** Counts the host panel gates on: seated, viewed, total. */
export function deriveWerewolfSeatCounts(
  state: GameState,
  viewModel: WerewolfViewModel,
): {
  readonly seatedCount: number;
  readonly viewedCount: number;
  readonly totalSeats: number;
} {
  return {
    seatedCount: viewModel.seats.length,
    viewedCount: viewModel.viewedSeats.length,
    // Bottom-card boards (thief / treasure master) carry more roles than seats.
    totalSeats: getPlayerCount(state.templateRoles),
  };
}

export function createWerewolfRoomShellModel(input: WerewolfRoomShellModelInput): RoomShellModel {
  const { state, viewModel, controlledSeat } = input;
  const hasBots = Object.values(state.roster).some((occupant) => isBotOccupant(occupant));
  const counts = deriveWerewolfSeatCounts(state, viewModel);

  const buildHostManagement = () =>
    createWerewolfHostManagement({
      roomStatus: viewModel.status,
      panelFlow: input.panelFlow,
      isReviewShared: (state.nightReviewAllowedSeats ?? []).some(
        (seat) => state.roster[seat] !== undefined,
      ),
      isPlagueMode: state.rules?.isPlagueMode ?? false,
      hasUnviewedOwnRole:
        input.viewer.seat !== null && !viewModel.viewedSeats.includes(input.viewer.seat),
      ...counts,
      isAudioPlaying: state.isAudioPlaying,
      isHostActionSubmitting: input.isHostActionSubmitting,
      mvpSeat: viewModel.day.mvpSeat,
      onSelectMvp: input.onSelectMvp,
      canMarkAllBotsViewed:
        hasBots &&
        viewModel.status === GameStatus.Assigned &&
        viewModel.seats.some((seat) => seat.isBot && !seat.hasViewedRole),
      canMarkAllBotsGroupConfirmed:
        hasBots &&
        !state.isAudioPlaying &&
        viewModel.status === GameStatus.Ongoing &&
        viewModel.canAcknowledgeStepBots,
      capabilities: input.capabilities,
      sheriffElection: input.sheriffElectionPanel,
      onHostControl: input.onHostControl,
      onMarkAllBotsViewed: input.onMarkAllBotsViewed,
      onMarkAllBotsGroupConfirmed: input.onMarkAllBotsGroupConfirmed,
      onMusicSettings: input.onMusicSettings,
      review: input.review,
      onGrantReviewAccess: input.onGrantReviewAccess,
      onLastNightInfo: input.onLastNightInfo,
      onLastNightDeaths: input.onLastNightDeaths,
      announcements: input.announcements,
      onAnnouncement: input.onAnnouncement,
    });

  const controlledBot = controlledSeat === null ? null : state.roster[controlledSeat];
  return createRoomShellModel({
    roomCode: input.roomCode,
    viewer: input.viewer,
    capabilities: input.capabilities,
    connection: input.connection,
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    onSeatPress: input.onSeatPress,
    phase: viewModel.status,
    step: state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : null,
    isAudioPlaying: state.isAudioPlaying,
    isSubmitting: input.isSubmitting,
    pendingActionKey: input.pendingActionKey,
    onBack: input.onBack,
    onTitlePress: input.onTitlePress,
    onTitleLongPress: input.onTitleLongPress,
    user: input.user,
    gachaStatus: input.gachaStatus,
    onUserActionPress: input.onUserActionPress,
    seatSource: createWerewolfSeatDataSource({
      state,
      viewModel,
      seatSelection: input.seatSelection ?? null,
      controlledSeat,
      sheriffElectionView: input.sheriffElectionPanel?.view ?? null,
      revision: `${input.revision}:${controlledSeat ?? 'self'}:${input.seatSelection?.eligible.join(',') ?? '-'}:${selectedSeats(input.seatSelection).join(',')}`,
    }),
    seatsVisuallyDisabled: isAudioPlaybackLocked(state.isAudioPlaying) || input.isActionSubmitting,
    onBotSeatLongPress: input.onBotSeatLongPress,
    playerActions: input.playerActions,
    buildHostManagement,
    controlledSeat: createControlledSeatModel({
      controlledSeat,
      controlledBotName:
        controlledBot != null && isBotOccupant(controlledBot) && controlledSeat !== null
          ? getBotDisplayName(controlledSeat)
          : null,
      release: input.onReleaseBot,
      gameName: 'Werewolf',
    }),
  });
}

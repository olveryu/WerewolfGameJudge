/**
 * werewolfRoomAdapter — Werewolf's projections onto the shared room shell.
 *
 * Every function here is a pure mapping from the authoritative facts
 * (GameState, the viewer-cropped WerewolfViewModel, the night
 * interaction model) plus a few UI states into the shared room
 * contracts: capabilities, seat data source, bottom actions, board
 * info, and the shell model. No game rule is derived here — the engine
 * projected them; this file only decides presentation.
 */

import type {
  GameState,
  RoleId,
  SchemaId,
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
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';

import { isAudioPlaybackLocked } from '@/features/room/model/audioPlaybackLock';
import type { BoardInfoSection, RoleDisplayItem } from '@/features/room/model/BoardInfoSection';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import type { NightStepProgress } from '@/features/room/model/nightProgress';
import { resolveStepProgress } from '@/features/room/model/nightProgress';
import {
  buildStepActorWaitingMessage,
  buildViewIdentityButton,
  type RoomBottomActionLayout,
  type RoomBottomActionModel,
  type RoomBottomButton,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomBottomActions';
import {
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomCapability,
  type RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatStatusBadge,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { resolveRoomViewerAudience } from '@/features/room/model/RoomViewer';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import {
  createWerewolfHostManagement,
  type WerewolfHostControlAction,
} from './createWerewolfHostManagement';
import type { PanelFlowProgress } from './day/panelFlow';
import { createSheriffElectionDockModel } from './day/sheriffElectionDockModel';
import type { SheriffElectionViewModel } from './day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from './day/useSheriffElection';
import type { NightInteractionModel } from './night/NightInteractionModel';

export const WEREWOLF_DISPLAY_NAME = '狼人杀';
const ACTION_SUBMITTING_REASON = '行动正在确认中';

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
  readonly night: NightInteractionModel;
  readonly controlledSeat: number | null;
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

function formatWolfVoteBadge(vote: number): string {
  const emptyVoteText = SCHEMAS.wolfKill.ui?.emptyVoteText;
  if (emptyVoteText === undefined)
    throw new Error('[FAIL-FAST] wolfKill schema has no emptyVoteText');
  return vote === -1 ? emptyVoteText : `袭击${formatSeat(vote)}`;
}

/** Seats the night model marks as picked (swap pair, multi-select set). */
export function selectedNightSeats(night: NightInteractionModel): readonly number[] {
  switch (night.kind) {
    case 'pickTwoSeats':
      return [night.pick.first, night.pick.second].filter((seat): seat is number => seat !== null);
    case 'multiSelect':
      return night.selected;
    default:
      return [];
  }
}

export function createWerewolfSeatDataSource(input: WerewolfSeatSourceInput): RoomSeatDataSource {
  const { state, viewModel, night, controlledSeat } = input;
  const status = viewModel.status;
  const seatCount = viewModel.template.numberOfPlayers;
  const seatViews = new Map(viewModel.seats.map((seat) => [seat.seat, seat]));
  const selected = new Set(selectedNightSeats(night));
  const wolfVotes = viewModel.night.wolfVote?.votes ?? null;
  const showReadyBadges = status === GameStatus.Assigned || status === GameStatus.Ready;
  const groupReveal = viewModel.night.reveals[0] ?? null;
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
      const wolfVote = isWolfPeer && wolfVotes !== null ? wolfVotes[String(seat)] : undefined;
      const hasReadyBadge =
        wolfVote === undefined &&
        ((showReadyBadges && player !== null && (seatView?.hasViewedRole ?? false)) ||
          (groupReveal?.ackedSeats.includes(seat) ?? false));
      return {
        seat,
        player,
        isSelf: seat === viewModel.mySeat,
        highlight:
          controlledSeat === seat
            ? 'controlled'
            : selected.has(seat)
              ? 'selected'
              : isWolfPeer
                ? 'danger'
                : 'none',
        secondaryLabel:
          seatView !== null && seatView.isBot && seatView.visibleRole !== null
            ? getRoleDisplayName(seatView.visibleRole)
            : null,
        disabledReason: seatView?.disabledReason ?? undefined,
        showReadyBadge: hasReadyBadge,
        statusBadge:
          getSheriffSeatStatusBadge(input.sheriffElectionView, seat) ??
          (wolfVote === undefined
            ? null
            : { label: formatWolfVoteBadge(wolfVote), tone: 'danger' }),
        indicators: null,
        isStatusEmphasized: false,
        showLevel: showLevelsAndDecorations,
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

/** What a night button does when pressed; the hook maps each to a dialog or a submit. */
export type NightButtonAction =
  | { readonly kind: 'skip' }
  | { readonly kind: 'emptyVote' }
  | { readonly kind: 'withdrawVote' }
  | { readonly kind: 'save' }
  | { readonly kind: 'openStatus' }
  | { readonly kind: 'openGroupReveal' }
  | { readonly kind: 'openHunterStatus' }
  | { readonly kind: 'openChooseCard' }
  | { readonly kind: 'confirmMultiSelect' };

export interface NightButtonSpec {
  readonly key: string;
  readonly label: string;
  readonly tier: 'primary' | 'secondary';
  readonly action: NightButtonAction;
  readonly testID?: string;
}

/** The night step's buttons for the actioner, per model kind. */
export function buildNightButtons(night: NightInteractionModel): readonly NightButtonSpec[] {
  switch (night.kind) {
    case 'idle':
    case 'blocked':
    case 'ackReveal':
      return [];
    case 'skipOnly':
      return [{ key: 'skip', label: night.skipLabel, tier: 'secondary', action: { kind: 'skip' } }];
    case 'pickSeat':
    case 'pickTwoSeats':
      return night.skipLabel === null
        ? []
        : [{ key: 'skip', label: night.skipLabel, tier: 'secondary', action: { kind: 'skip' } }];
    case 'wolfVote': {
      const buttons: NightButtonSpec[] = [];
      if (night.myVote !== null && !night.emptyVoteOnly) {
        buttons.push({
          key: 'wolfCancel',
          label: '取消投票',
          tier: 'secondary',
          action: { kind: 'withdrawVote' },
        });
      }
      buttons.push({
        key: 'wolfEmpty',
        label: night.emptyVoteLabel,
        tier: 'secondary',
        action: { kind: 'emptyVote' },
      });
      return buttons;
    }
    case 'witch': {
      const buttons: NightButtonSpec[] = [];
      if (night.canSave) {
        buttons.push({
          key: 'save',
          label: night.saveLabel,
          tier: 'primary',
          action: { kind: 'save' },
        });
      }
      buttons.push({
        key: 'skip',
        label: night.skipLabel,
        tier: 'secondary',
        action: { kind: 'skip' },
      });
      return buttons;
    }
    case 'confirmStatus':
      return [
        {
          key: 'confirm',
          label: night.buttonLabel,
          tier: 'primary',
          action: { kind: 'openStatus' },
        },
      ];
    case 'ackGroupReveal':
      return [
        {
          key: 'groupConfirmAck',
          label: night.openLabel,
          tier: 'primary',
          action: { kind: 'openGroupReveal' },
        },
      ];
    case 'ackHunterStatus':
      return [
        {
          key: 'viewHunterStatus',
          label: night.buttonLabel,
          tier: 'primary',
          action: { kind: 'openHunterStatus' },
        },
      ];
    case 'multiSelect': {
      const buttons: NightButtonSpec[] = [];
      if (night.selected.length > 0) {
        buttons.push({
          key: 'multiConfirm',
          label: night.confirmButtonTemplate.replace('{count}', String(night.selected.length)),
          tier: 'primary',
          action: { kind: 'confirmMultiSelect' },
        });
      }
      if (night.skipLabel !== null) {
        buttons.push({
          key: 'skip',
          label: night.skipLabel,
          tier: 'secondary',
          action: { kind: 'skip' },
        });
      }
      return buttons;
    }
    case 'chooseCard':
      return [
        {
          key: 'chooseCard',
          label: night.openLabel,
          tier: 'primary',
          action: { kind: 'openChooseCard' },
        },
      ];
  }
}

interface WerewolfBottomLayoutInput {
  readonly viewModel: WerewolfViewModel;
  readonly night: NightInteractionModel;
  readonly isHost: boolean;
  readonly effectiveSeat: number | null;
  readonly isAudioPlaying: boolean;
  readonly isActionSubmitting: boolean;
  readonly canOpenNightReview: boolean;
  readonly onNightButton: (action: NightButtonAction) => void;
  readonly onViewRole: () => void;
  readonly onNightReview: () => void;
}

function nightButton(spec: NightButtonSpec, input: WerewolfBottomLayoutInput): RoomBottomButton {
  const base = {
    key: spec.key,
    label: spec.label,
    audience: 'participant' as const,
    variant: spec.tier,
    size: 'md' as const,
    testID: spec.testID,
  };
  if (input.isActionSubmitting) {
    return { ...base, isEnabled: false, disabledReason: ACTION_SUBMITTING_REASON };
  }
  return { ...base, isEnabled: true, onPress: () => input.onNightButton(spec.action) };
}

function viewRoleButton(
  input: WerewolfBottomLayoutInput,
  variant: 'primary' | 'secondary',
): RoomBottomButton {
  return buildViewIdentityButton(
    { label: VIEW_IDENTITY_LABEL, onPress: input.onViewRole },
    { key: 'viewRole', variant, audience: 'participant', isSubmitting: input.isActionSubmitting },
  );
}

function nightReviewButton(
  input: WerewolfBottomLayoutInput,
  variant: 'primary' | 'ghost',
): RoomBottomButton {
  return {
    key: 'nightReview',
    label: '本局复盘',
    audience: 'anyone',
    icon: 'document-text-outline',
    variant,
    size: 'md',
    testID: TESTIDS.nightReviewBottomButton,
    isEnabled: true,
    onPress: input.onNightReview,
  };
}

const EMPTY_LAYOUT: RoomBottomActionLayout = { primary: [], secondary: [], ghost: [] };

/**
 * The bottom button layout per status and audience: identity viewing from
 * the deal on, the night step's own buttons for the actioner, the review
 * entry for allowed seats and spectators from the day on; nothing while
 * narration plays.
 */
export function createWerewolfBottomActionLayout(
  input: WerewolfBottomLayoutInput,
): RoomBottomActionLayout {
  const { viewModel, night } = input;
  const audience = resolveRoomViewerAudience({ isHost: input.isHost, seat: input.effectiveSeat });
  const hasSeat = input.effectiveSeat !== null;
  const viewRole = (variant: 'primary' | 'secondary') =>
    hasSeat ? [viewRoleButton(input, variant)] : [];

  switch (viewModel.status) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
      return EMPTY_LAYOUT;
    case GameStatus.Assigned:
    case GameStatus.Ready:
      return { primary: viewRole('primary'), secondary: [], ghost: [] };
    case GameStatus.Ongoing: {
      if (isAudioPlaybackLocked(input.isAudioPlaying)) return EMPTY_LAYOUT;
      const buttons = buildNightButtons(night).map((spec) => nightButton(spec, input));
      return {
        primary: buttons.filter((button) => button.variant === 'primary'),
        secondary: [
          ...buttons.filter((button) => button.variant === 'secondary'),
          ...viewRole('secondary'),
        ],
        ghost: [],
      };
    }
    case GameStatus.Day:
    case GameStatus.Ended: {
      // The night-end announcement window: narration is still playing
      // after the status has moved on. Every audience collapses,
      // spectators included — opening the review starts capture and
      // writes flow progress, so it is not read-only.
      if (isAudioPlaybackLocked(input.isAudioPlaying)) return EMPTY_LAYOUT;
      if (audience === 'spectator') {
        return { primary: [nightReviewButton(input, 'primary')], secondary: [], ghost: [] };
      }
      return {
        primary: [],
        secondary: viewRole('secondary'),
        ghost:
          audience === 'seated' && input.canOpenNightReview
            ? [nightReviewButton(input, 'ghost')]
            : [],
      };
    }
  }
}

interface WerewolfBottomActionsInput {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly night: NightInteractionModel;
  readonly isHost: boolean;
  readonly isAudioPlaying: boolean;
  readonly layout: RoomBottomActionLayout;
  /** The actioner's bottom message (prompt + status lines); null for non-actioners. */
  readonly actionMessage: string | null;
  readonly guideMessage: string | null;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly isSheriffInspectorVisible: boolean;
  readonly openSheriffDetails: () => void;
}

export function createWerewolfBottomActions(
  input: WerewolfBottomActionsInput,
): RoomBottomActionModel {
  const { state, viewModel, layout } = input;
  if (viewModel.status === GameStatus.Day && input.sheriffElectionPanel !== null) {
    return createSheriffElectionDockModel({
      election: input.sheriffElectionPanel,
      roomTools: layout,
      isHost: input.isHost,
      isInspectorVisible: input.isSheriffInspectorVisible,
      isAudioPlaying: input.isAudioPlaying,
      openDetails: input.openSheriffDetails,
    });
  }
  if (viewModel.status === GameStatus.Ended) {
    return { kind: 'stacked', message: input.guideMessage, progress: null, layout };
  }
  const progress = deriveWerewolfBottomProgress(state);
  const isActioner = viewModel.status === GameStatus.Ongoing && viewModel.night.isActioner;
  const waiting =
    viewModel.status === GameStatus.Ongoing && !isActioner
      ? buildStepActorWaitingMessage(progress)
      : null;
  return {
    kind: 'stacked',
    message: isAudioPlaybackLocked(input.isAudioPlaying)
      ? null
      : isActioner
        ? input.actionMessage
        : (waiting ?? input.guideMessage),
    progress,
    layout,
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
    { title: '狼人', items: items.wolf, color: colors.wolf },
    { title: '神职', items: items.god, color: colors.god },
    { title: '特殊', items: items.special, color: colors.third },
    {
      title: '村民',
      items:
        items.villagerCount > 0
          ? [
              { roleId: 'villager', displayName: '村民', count: items.villagerCount },
              ...items.villager,
            ]
          : items.villager,
      color: colors.villager,
    },
  ];
}

// =============================================================================
// Shell model
// =============================================================================

export interface WerewolfRoomShellModelInput extends Pick<
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
  readonly night: NightInteractionModel;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly onReleaseBot: () => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly isActionSubmitting: boolean;
  readonly isStartingGame: boolean;
  readonly isHostActionSubmitting: boolean;
  readonly bottomActions: RoomBottomActionModel;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly panelFlow: PanelFlowProgress;
  readonly onHostControl: (action: WerewolfHostControlAction) => void;
  readonly onMusicSettings: () => void;
  readonly onMarkAllBotsViewed: () => void;
  readonly onMarkAllBotsGroupConfirmed: () => void;
  readonly onNightReview: () => void;
  readonly onLastNightInfo: () => void;
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
  const { state, viewModel, night, controlledSeat } = input;
  const hasBots = Object.values(state.roster).some((occupant) => isBotOccupant(occupant));
  const counts = deriveWerewolfSeatCounts(state, viewModel);

  const buildHostManagement = () =>
    createWerewolfHostManagement({
      roomStatus: viewModel.status,
      panelFlow: input.panelFlow,
      isReviewShared: (state.nightReviewAllowedSeats ?? []).length > 0,
      isPlagueMode: state.rules?.isPlagueMode ?? false,
      ...counts,
      isAudioPlaying: state.isAudioPlaying,
      isStartingGame: input.isStartingGame,
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
        viewModel.night.actionSchema?.kind === 'groupConfirm',
      capabilities: input.capabilities,
      sheriffElection: input.sheriffElectionPanel,
      onHostControl: input.onHostControl,
      onMusicSettings: input.onMusicSettings,
      onMarkAllBotsViewed: input.onMarkAllBotsViewed,
      onMarkAllBotsGroupConfirmed: input.onMarkAllBotsGroupConfirmed,
      onNightReview: input.onNightReview,
      onLastNightInfo: input.onLastNightInfo,
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
    onBack: input.onBack,
    onTitlePress: input.onTitlePress,
    onTitleLongPress: input.onTitleLongPress,
    user: input.user,
    gachaStatus: input.gachaStatus,
    onUserActionPress: input.onUserActionPress,
    seatSource: createWerewolfSeatDataSource({
      state,
      viewModel,
      night,
      controlledSeat,
      sheriffElectionView: input.sheriffElectionPanel?.view ?? null,
      revision: `${input.revision}:${controlledSeat ?? 'self'}:${selectedNightSeats(night).join(',')}`,
    }),
    seatsVisuallyDisabled: isAudioPlaybackLocked(state.isAudioPlaying) || input.isActionSubmitting,
    onBotSeatLongPress: input.onBotSeatLongPress,
    bottomActions: input.bottomActions,
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

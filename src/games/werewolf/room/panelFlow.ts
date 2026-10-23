/**
 * Bottom-panel "next step" flow for the Day and Ended phases.
 *
 * The panel's grammar in these phases is a guided sequence, not a
 * button shelf: 昨夜信息 (last night's result — the step completes
 * only when the viewer confirms it in the dialog, mirroring the
 * in-person announcement) → 本局复盘 (game review) → 收尾 (closing
 * actions). Progress is pure client-local state (see
 * panelFlowProgressStore); it never enters room state.
 *
 * The review step completes on open for a player. The host's review
 * step completes only once the review has actually been shared with
 * at least one seat (the engine's nightReviewAllowedSeats is
 * non-empty — the share itself is the `werewolf.review.share`
 * command, reachable from the review dialog's 授权玩家查看 entry).
 * A player the host never shared the review with has no review step
 * at all: their Ended flow is 昨夜信息 → 收尾. Spectators never
 * enter the flow (no step bar, no step primaries) — their panel is
 * a single review button instead.
 *
 * Day runs only the first step: once the last-night info is confirmed
 * the panel returns to the phase's own actions and the info demotes to
 * a ghost tool. A game that ends mid-Day (e.g. a wolf self-detonates)
 * continues the same progress in Ended — the flow is derived from the
 * room status plus the progress record, never from the path taken.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomPanelStep } from '@/features/room/model/RoomBottomActions';

export type PanelFlowStepId = 'lastNightInfo' | 'nightReview' | 'closing';

/** Who is looking at the panel; the flow exists for host and seated players only. */
export type PanelFlowViewerRole = 'host' | 'player' | 'spectator';

/**
 * The viewer facts the flow derivation reads. `reviewShared` and
 * `reviewAuthorized` both come from the engine's
 * nightReviewAllowedSeats (room state, not local progress): the
 * host's share gate and the player's step existence follow the game,
 * so being authorized mid-Ended makes the step appear on its own.
 */
export interface PanelFlowViewer {
  readonly role: PanelFlowViewerRole;
  /** The host has shared the review with at least one seat in this game. */
  readonly reviewShared: boolean;
  /**
   * This viewer may open the review: always true for the host; for a
   * player, only when their own seat was shared the review.
   */
  readonly reviewAuthorized: boolean;
}

export interface PanelFlowProgress {
  readonly lastNightInfoConfirmed: boolean;
  readonly nightReviewOpened: boolean;
}

export const EMPTY_PANEL_FLOW_PROGRESS: PanelFlowProgress = {
  lastNightInfoConfirmed: false,
  nightReviewOpened: false,
};

/** Reminder shown to the host while the review step is current. */
export const PANEL_FLOW_SHARE_HINT = '记得把复盘分享给第一天出局的玩家';

const PANEL_FLOW_STEP_LABELS: Readonly<Record<PanelFlowStepId, string>> = {
  lastNightInfo: '昨夜信息',
  nightReview: '本局复盘',
  closing: '收尾',
};

const PANEL_FLOW_STEP_ORDER: readonly PanelFlowStepId[] = [
  'lastNightInfo',
  'nightReview',
  'closing',
];

/** Steps this viewer walks, in order; a player without the review skips its step. */
function panelFlowStepOrder(viewer: PanelFlowViewer): readonly PanelFlowStepId[] {
  if (viewer.role === 'player' && !viewer.reviewAuthorized) {
    return PANEL_FLOW_STEP_ORDER.filter((step) => step !== 'nightReview');
  }
  return PANEL_FLOW_STEP_ORDER;
}

function isStepComplete(
  step: PanelFlowStepId,
  progress: PanelFlowProgress,
  viewer: PanelFlowViewer,
): boolean {
  if (step === 'lastNightInfo') return progress.lastNightInfoConfirmed;
  if (step === 'nightReview') {
    if (!progress.nightReviewOpened) return false;
    // The host must also have really shared the review (with any
    // seat, at any point in this game — Day included).
    return viewer.role === 'host' ? viewer.reviewShared : true;
  }
  return false;
}

/**
 * The step the panel is currently guiding towards, or null when the
 * flow does not apply (any status other than Day/Ended, a spectator,
 * or Day after the first step — the phase's own actions take over).
 */
export function resolvePanelFlowCurrentStep(
  roomStatus: GameStatus,
  progress: PanelFlowProgress,
  viewer: PanelFlowViewer,
): PanelFlowStepId | null {
  if (viewer.role === 'spectator') return null;
  if (roomStatus === GameStatus.Day) {
    return progress.lastNightInfoConfirmed ? null : 'lastNightInfo';
  }
  if (roomStatus === GameStatus.Ended) {
    if (!progress.lastNightInfoConfirmed) return 'lastNightInfo';
    if (
      panelFlowStepOrder(viewer).includes('nightReview') &&
      !isStepComplete('nightReview', progress, viewer)
    ) {
      return 'nightReview';
    }
    return 'closing';
  }
  return null;
}

export interface PanelFlowStepsInput {
  readonly roomStatus: GameStatus;
  readonly progress: PanelFlowProgress;
  readonly viewer: PanelFlowViewer;
  readonly onOpenLastNightInfo: () => void;
  readonly onOpenNightReview: () => void;
}

/**
 * Step-bar model for the panel's message row, or null when the flow
 * does not apply to this viewer/status. Completed steps and the
 * current step are tappable (revisit / open); upcoming steps are
 * inert labels — the primary button is the only way forward.
 */
export function buildPanelFlowSteps(input: PanelFlowStepsInput): readonly RoomPanelStep[] | null {
  const { roomStatus, progress, viewer } = input;
  if (viewer.role === 'spectator') return null;
  if (roomStatus !== GameStatus.Day && roomStatus !== GameStatus.Ended) return null;
  const currentStep = resolvePanelFlowCurrentStep(roomStatus, progress, viewer);
  return panelFlowStepOrder(viewer).map((step) => {
    const complete = isStepComplete(step, progress, viewer);
    const state: RoomPanelStep['state'] = complete
      ? 'complete'
      : step === currentStep
        ? 'current'
        : 'upcoming';
    const onPress =
      step === 'lastNightInfo' && (complete || state === 'current')
        ? input.onOpenLastNightInfo
        : step === 'nightReview' && (complete || state === 'current')
          ? input.onOpenNightReview
          : undefined;
    return { key: step, label: PANEL_FLOW_STEP_LABELS[step], state, onPress };
  });
}

/**
 * The host-only share reminder: shown while the review step is
 * current at Ended. It is the gate's own explanation — the step
 * completes only once the host has really shared the review.
 */
export function resolvePanelFlowHint(input: {
  readonly roomStatus: GameStatus;
  readonly isHost: boolean;
  readonly progress: PanelFlowProgress;
  readonly reviewShared: boolean;
}): string | null {
  if (!input.isHost) return null;
  const viewer: PanelFlowViewer = {
    role: 'host',
    reviewShared: input.reviewShared,
    reviewAuthorized: true,
  };
  return resolvePanelFlowCurrentStep(input.roomStatus, input.progress, viewer) === 'nightReview'
    ? PANEL_FLOW_SHARE_HINT
    : null;
}

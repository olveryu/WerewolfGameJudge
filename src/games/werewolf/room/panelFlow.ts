/**
 * Bottom-panel "next step" flow for the Day and Ended phases.
 *
 * The panel's grammar in these phases is a guided sequence, not a
 * button shelf: 昨夜信息 (last night's result — the step completes
 * only when the viewer confirms it in the dialog, mirroring the
 * in-person announcement) → 本局复盘 (game review — completes on
 * open) → 收尾 (closing actions). Progress is pure client-local state
 * (see panelFlowProgressStore); it never enters room state.
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

function isStepComplete(step: PanelFlowStepId, progress: PanelFlowProgress): boolean {
  if (step === 'lastNightInfo') return progress.lastNightInfoConfirmed;
  if (step === 'nightReview') return progress.nightReviewOpened;
  return false;
}

/**
 * The step the panel is currently guiding towards, or null when the
 * flow does not apply (any status other than Day/Ended) or has paused
 * (Day after the first step — the phase's own actions take over).
 */
export function resolvePanelFlowCurrentStep(
  roomStatus: GameStatus,
  progress: PanelFlowProgress,
): PanelFlowStepId | null {
  if (roomStatus === GameStatus.Day) {
    return progress.lastNightInfoConfirmed ? null : 'lastNightInfo';
  }
  if (roomStatus === GameStatus.Ended) {
    if (!progress.lastNightInfoConfirmed) return 'lastNightInfo';
    if (!progress.nightReviewOpened) return 'nightReview';
    return 'closing';
  }
  return null;
}

export interface PanelFlowStepsInput {
  readonly roomStatus: GameStatus;
  readonly progress: PanelFlowProgress;
  readonly onOpenLastNightInfo: () => void;
  readonly onOpenNightReview: () => void;
}

/**
 * Step-bar model for the panel's message row, or null when the flow
 * does not apply to this status. Completed steps and the current step
 * are tappable (revisit / open); upcoming steps are inert labels — the
 * primary button is the only way forward.
 */
export function buildPanelFlowSteps(input: PanelFlowStepsInput): readonly RoomPanelStep[] | null {
  const { roomStatus, progress } = input;
  if (roomStatus !== GameStatus.Day && roomStatus !== GameStatus.Ended) return null;
  const currentStep = resolvePanelFlowCurrentStep(roomStatus, progress);
  return PANEL_FLOW_STEP_ORDER.map((step) => {
    const complete = isStepComplete(step, progress);
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
 * The host-only share reminder: shown while the review step is current
 * at Ended. A reminder only — sharing itself is never verified.
 */
export function resolvePanelFlowHint(input: {
  readonly roomStatus: GameStatus;
  readonly isHost: boolean;
  readonly progress: PanelFlowProgress;
}): string | null {
  if (!input.isHost) return null;
  return resolvePanelFlowCurrentStep(input.roomStatus, input.progress) === 'nightReview'
    ? PANEL_FLOW_SHARE_HINT
    : null;
}

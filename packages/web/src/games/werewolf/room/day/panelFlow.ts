/**
 * Host task flow for the Day and Ended phases.
 *
 * The host's dawn work is a guided sequence, not a button shelf: 昨夜信息
 * (last night's result — the step completes only when the host confirms
 * it in the dialog, mirroring the in-person announcement). During Day,
 * the host may also grant seats access to the private review. Once the
 * game ends, review access is public and the host proceeds from the
 * last-night info directly to closing. Reading the review is not a step
 * of this flow: the host reads it from the sheet or closing task.
 * Progress is pure client-local state (a `useScopedDraft` draft in
 * `useWerewolfRoomState`); it never enters room state.
 *
 * The flow is rendered on the host task card (room-shell-contract "Host
 * Task"): steps come from here, the current step's sheet action is the
 * task. Day runs only the first step: once the last-night info is
 * confirmed the election's own task takes over and the steps leave. A
 * game that ends mid-Day continues the same progress in Ended — the
 * flow is derived from the room status plus the progress record, never
 * from the path taken.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomHostTaskStep } from '@/features/room/model/RoomHostManagement';

type PanelFlowStepId = 'lastNightInfo' | 'grantReview' | 'closing';

export interface PanelFlowProgress {
  readonly lastNightInfoConfirmed: boolean;
}

export const EMPTY_PANEL_FLOW_PROGRESS: PanelFlowProgress = {
  lastNightInfoConfirmed: false,
};

/** Sheet keys the flow steps reference (createWerewolfHostManagement). */
export const PANEL_FLOW_ACTION_KEYS = {
  lastNightInfo: 'last-night-info',
  grantReview: 'grant-review',
} as const;

const PANEL_FLOW_STEP_LABELS: Readonly<Record<PanelFlowStepId, string>> = {
  lastNightInfo: '昨夜信息',
  grantReview: '授权',
  closing: '收尾',
};

const PANEL_FLOW_STEP_ORDER: readonly PanelFlowStepId[] = [
  'lastNightInfo',
  'grantReview',
  'closing',
];

interface PanelFlowInput {
  readonly roomStatus: GameStatus;
  readonly progress: PanelFlowProgress;
  /** During Day, the host has granted the review to at least one seat. */
  readonly reviewShared: boolean;
}

function isStepComplete(step: PanelFlowStepId, input: PanelFlowInput): boolean {
  if (step === 'lastNightInfo') return input.progress.lastNightInfoConfirmed;
  if (step === 'grantReview') return input.reviewShared;
  return false;
}

/**
 * The step the flow currently guides the host towards, or null when the
 * flow does not apply (any status other than Day/Ended, or Day after the
 * first step — the phase's own task takes over).
 */
export function resolvePanelFlowCurrentStep(input: PanelFlowInput): PanelFlowStepId | null {
  if (input.roomStatus === GameStatus.Day) {
    return input.progress.lastNightInfoConfirmed ? null : 'lastNightInfo';
  }
  if (input.roomStatus === GameStatus.Ended) {
    if (!input.progress.lastNightInfoConfirmed) return 'lastNightInfo';
    return 'closing';
  }
  return null;
}

/**
 * Task-card steps for the flow, or null when it does not apply. Completed
 * and current info/grant steps reference their sheet action so the card
 * can revisit them; the closing step is the choice itself.
 */
export function buildPanelFlowSteps(input: PanelFlowInput): readonly RoomHostTaskStep[] | null {
  const currentStep = resolvePanelFlowCurrentStep(input);
  if (currentStep === null) return null;
  const steps =
    input.roomStatus === GameStatus.Ended
      ? PANEL_FLOW_STEP_ORDER.filter((step) => step !== 'grantReview')
      : PANEL_FLOW_STEP_ORDER;
  return steps.map((step) => {
    const state: RoomHostTaskStep['state'] = isStepComplete(step, input)
      ? 'complete'
      : step === currentStep
        ? 'current'
        : 'upcoming';
    const actionKey =
      step === 'lastNightInfo'
        ? PANEL_FLOW_ACTION_KEYS.lastNightInfo
        : step === 'grantReview'
          ? PANEL_FLOW_ACTION_KEYS.grantReview
          : undefined;
    return actionKey === undefined
      ? { key: step, label: PANEL_FLOW_STEP_LABELS[step], state }
      : { key: step, label: PANEL_FLOW_STEP_LABELS[step], state, actionKey };
  });
}

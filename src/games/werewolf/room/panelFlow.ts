/**
 * Host task flow for the Day and Ended phases.
 *
 * The host's dawn work is a guided sequence, not a button shelf: 昨夜信息
 * (last night's result — the step completes only when the host confirms
 * it in the dialog, mirroring the in-person announcement) → 本局复盘
 * (game review, complete once opened AND shared with at least one seat —
 * the engine's nightReviewAllowedSeats is non-empty) → 收尾 (closing).
 * Progress is pure client-local state (see panelFlowProgressStore); it
 * never enters room state.
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

/** Sheet keys the flow steps reference (createWerewolfHostManagement). */
export const PANEL_FLOW_ACTION_KEYS = {
  lastNightInfo: 'last-night-info',
  nightReview: 'night-review',
} as const;

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

export interface PanelFlowInput {
  readonly roomStatus: GameStatus;
  readonly progress: PanelFlowProgress;
  /** The host has shared the review with at least one seat in this game. */
  readonly reviewShared: boolean;
}

function isStepComplete(step: PanelFlowStepId, input: PanelFlowInput): boolean {
  if (step === 'lastNightInfo') return input.progress.lastNightInfoConfirmed;
  if (step === 'nightReview') return input.progress.nightReviewOpened && input.reviewShared;
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
    if (!isStepComplete('nightReview', input)) return 'nightReview';
    return 'closing';
  }
  return null;
}

/**
 * Task-card steps for the flow, or null when it does not apply. Completed
 * and current info/review steps reference their sheet action so the card
 * can revisit them; the closing step is the choice itself.
 */
export function buildPanelFlowSteps(input: PanelFlowInput): readonly RoomHostTaskStep[] | null {
  const currentStep = resolvePanelFlowCurrentStep(input);
  if (currentStep === null) return null;
  return PANEL_FLOW_STEP_ORDER.map((step) => {
    const state: RoomHostTaskStep['state'] = isStepComplete(step, input)
      ? 'complete'
      : step === currentStep
        ? 'current'
        : 'upcoming';
    const actionKey =
      step === 'lastNightInfo'
        ? PANEL_FLOW_ACTION_KEYS.lastNightInfo
        : step === 'nightReview'
          ? PANEL_FLOW_ACTION_KEYS.nightReview
          : undefined;
    return actionKey === undefined
      ? { key: step, label: PANEL_FLOW_STEP_LABELS[step], state }
      : { key: step, label: PANEL_FLOW_STEP_LABELS[step], state, actionKey };
  });
}

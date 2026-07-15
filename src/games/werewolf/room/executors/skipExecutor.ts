/**
 * skipExecutor — Handles 'skip' ActionIntent
 *
 * Shows a skip-confirmation dialog, then submits the canonical skip input.
 */

import { BLOCKED_UI_DEFAULTS } from '@werewolf/game-engine/games/werewolf/public';

import { getSubStepByKey } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

/** Skip-action executor. */
export const skipExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, proceedWithAction, actionDialogs } = ctx;

  const skipStepSchema = getSubStepByKey(currentSchema, intent.stepKey);
  const skipConfirmText =
    currentSchema?.kind === 'confirm'
      ? intent.message || BLOCKED_UI_DEFAULTS.skipButtonText
      : skipStepSchema?.ui?.confirmText || intent.message;
  if (!skipConfirmText) {
    throw new Error(`[FAIL-FAST] Missing confirmText for skip action: ${intent.stepKey}`);
  }

  actionDialogs.showConfirmDialog('跳过本次行动？', skipConfirmText, async () => {
    await proceedWithAction({ kind: 'skip' });
  });
};

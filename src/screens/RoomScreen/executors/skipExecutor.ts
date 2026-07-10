/**
 * skipExecutor — Handles 'skip' ActionIntent
 *
 * Shows a skip-confirmation dialog, then submits null / witch step results
 * depending on whether the schema is confirm, compound, or simple.
 */

import type { WerewolfActionInput } from '@werewolf/game-engine';
import { BLOCKED_UI_DEFAULTS } from '@werewolf/game-engine/models/roles/spec';

import { buildWitchActionInput, getSubStepByKey } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

/** Skip-action executor. */
export const skipExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, proceedWithAction, actionDialogs } = ctx;

  if (currentSchema?.kind === 'confirm') {
    actionDialogs.showConfirmDialog(
      '跳过本次行动？',
      intent.message || BLOCKED_UI_DEFAULTS.skipButtonText,
      async () => {
        await proceedWithAction({ kind: 'confirm', confirmed: false });
      },
    );
    return;
  }

  const skipStepSchema = getSubStepByKey(currentSchema, intent.stepKey);
  const actionInput: WerewolfActionInput =
    currentSchema?.kind === 'compound'
      ? buildWitchActionInput({ saveTarget: null, poisonTarget: null })
      : { kind: 'target', target: null };

  const skipConfirmText = skipStepSchema?.ui?.confirmText || intent.message;
  if (!skipConfirmText) {
    throw new Error(`[FAIL-FAST] Missing confirmText for skip action: ${intent.stepKey}`);
  }

  actionDialogs.showConfirmDialog('跳过本次行动？', skipConfirmText, async () => {
    await proceedWithAction(actionInput);
  });
};

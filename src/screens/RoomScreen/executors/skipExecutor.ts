/**
 * skipExecutor — Handles 'skip' ActionIntent
 *
 * Shows a skip-confirmation dialog, then submits null / witch step results
 * depending on whether the schema is confirm, compound, or simple.
 */

import { BLOCKED_UI_DEFAULTS } from '@werewolf/game-engine/models/roles/spec';

import { roomScreenLog } from '@/utils/logger';

import { buildWitchStepResults, getSubStepByKey } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

export const skipExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, effectiveSeat, proceedWithAction, actionDialogs } = ctx;

  if (currentSchema?.kind === 'confirm') {
    actionDialogs.showConfirmDialog(
      '跳过本次行动？',
      intent.message || BLOCKED_UI_DEFAULTS.skipButtonText,
      async () => {
        await proceedWithAction(null, { confirmed: false });
      },
    );
    return;
  }

  const skipStepSchema = getSubStepByKey(currentSchema, intent.stepKey);
  let skipExtra: ReturnType<typeof buildWitchStepResults> | undefined;
  let skipSeat: number | null = null;

  if (intent.stepKey === 'skipAll' || currentSchema?.kind === 'compound') {
    if (effectiveSeat === null) {
      roomScreenLog.warn('Cannot submit compound skip without seat (effectiveSeat is null)');
      return;
    }
    skipExtra = buildWitchStepResults({ saveTarget: null, poisonTarget: null });
    skipSeat = effectiveSeat;
  }

  const skipConfirmText = skipStepSchema?.ui?.confirmText || intent.message;
  if (!skipConfirmText) {
    throw new Error(`[FAIL-FAST] Missing confirmText for skip action: ${intent.stepKey}`);
  }

  actionDialogs.showConfirmDialog('跳过本次行动？', skipConfirmText, async () => {
    await proceedWithAction(skipSeat, skipExtra);
  });
};

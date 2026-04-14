/**
 * actionSubmitExecutor — Handles 'magicianFirst' and 'actionConfirm' ActionIntents
 *
 * 'magicianFirst': Records the first magician swap target, shows first-pick alert.
 * 'actionConfirm': Shows confirmation dialog, then submits action with typed extra
 * (witch step results for compound, swap targets for magician, plain target for simple).
 */

import { roomScreenLog } from '@/utils/logger';

import { buildWitchStepResults, getSubStepByKey } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

export const magicianFirstExecutor: IntentExecutor = (intent, ctx) => {
  roomScreenLog.debug('magicianFirst', {
    targetSeat: intent.targetSeat,
  });
  ctx.setFirstSwapSeat(intent.targetSeat);
  ctx.actionDialogs.showMagicianFirstAlert(intent.targetSeat, ctx.currentSchema!);
};

export const actionConfirmExecutor: IntentExecutor = (intent, ctx) => {
  const {
    effectiveRole,
    effectiveSeat,
    firstSwapSeat,
    setFirstSwapSeat,
    setSecondSeat,
    currentSchema,
    proceedWithAction,
    actionDialogs,
  } = ctx;

  roomScreenLog.debug('actionConfirm Processing', {
    effectiveRole,
    effectiveSeat,
    firstSwapSeat,
    schemaKind: currentSchema?.kind,
    schemaId: currentSchema?.id,
    'intent.targetSeat': intent.targetSeat,
    'intent.stepKey': intent.stepKey,
  });

  if (effectiveRole === 'magician' && firstSwapSeat !== null) {
    const swapTargets: [number, number] = [firstSwapSeat, intent.targetSeat];
    setSecondSeat(intent.targetSeat);
    // setTimeout(0) ensures setSecondSeat triggers re-render before dialog shows,
    // so the UI reflects the second seat selection visually.
    setTimeout(() => {
      actionDialogs.showConfirmDialog(
        currentSchema!.ui!.confirmTitle!,
        intent.message ?? '',
        () => {
          setFirstSwapSeat(null);
          setSecondSeat(null);
          void proceedWithAction(null, { targets: swapTargets });
        },
        () => {
          setFirstSwapSeat(null);
          setSecondSeat(null);
        },
      );
    }, 0);
  } else {
    const stepSchema = getSubStepByKey(currentSchema, intent.stepKey);
    let extra: ReturnType<typeof buildWitchStepResults> | undefined;
    let targetToSubmit: number | null;

    if (currentSchema?.kind === 'compound') {
      if (effectiveSeat === null) {
        roomScreenLog.warn(
          '[actionConfirm] Cannot submit compound action without seat (effectiveSeat is null)',
        );
        return;
      }
      targetToSubmit = effectiveSeat;
      if (stepSchema?.key === 'save') {
        extra = buildWitchStepResults({
          saveTarget: intent.targetSeat,
          poisonTarget: null,
        });
      } else if (stepSchema?.key === 'poison') {
        extra = buildWitchStepResults({
          saveTarget: null,
          poisonTarget: intent.targetSeat,
        });
      }
    } else {
      targetToSubmit = intent.targetSeat;
    }

    roomScreenLog.debug('actionConfirm Submitting', {
      schemaKind: currentSchema?.kind,
      targetToSubmit,
      'intent.targetSeat': intent.targetSeat,
      extra,
    });

    actionDialogs.showConfirmDialog(
      stepSchema?.ui?.confirmTitle ?? currentSchema!.ui!.confirmTitle!,
      stepSchema?.ui?.confirmText ?? intent.message ?? '',
      () => void proceedWithAction(targetToSubmit, extra),
    );
  }
};

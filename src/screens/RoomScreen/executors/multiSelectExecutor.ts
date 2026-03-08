/**
 * multiSelectExecutor — Handles 'multiSelectToggle' and 'multiSelectConfirm'
 *
 * 'multiSelectToggle': Toggles a seat in the multi-select set, respecting
 * schema maxTargets cap.
 * 'multiSelectConfirm': Shows confirmation dialog with selected seats, then
 * submits via proceedWithAction.
 */

import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const multiSelectToggleExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, multiSelectedSeats, setMultiSelectedSeats } = ctx;

  const seat = intent.targetSeat;
  roomScreenLog.debug('[handleActionIntent] multiSelectToggle', { seat });
  const current = multiSelectedSeats;
  if (current.includes(seat)) {
    setMultiSelectedSeats(current.filter((s) => s !== seat));
  } else {
    const max = currentSchema?.kind === 'multiChooseSeat' ? currentSchema.maxTargets : undefined;
    if (max != null && current.length >= max) {
      roomScreenLog.debug('[multiSelectToggle] maxTargets reached, ignoring', { max });
      return;
    }
    setMultiSelectedSeats([...current, seat]);
  }
};

export const multiSelectConfirmExecutor: IntentExecutor = async (intent, ctx) => {
  const { currentSchema, proceedWithAction, setMultiSelectedSeats, actionDialogs } = ctx;

  const targets = intent.targets;
  if (!targets || targets.length === 0) {
    roomScreenLog.warn('[handleActionIntent] multiSelectConfirm with no targets');
    return;
  }
  roomScreenLog.debug('[handleActionIntent] multiSelectConfirm', { targets });

  // Schema-driven confirm dialog
  const confirmCopy = currentSchema!.ui!.confirmText!;
  const targetLabels = targets.map((s) => `${s + 1}号`).join('、');

  actionDialogs.showConfirmDialog(confirmCopy, `已选择: ${targetLabels}`, async () => {
    const accepted = await proceedWithAction(null, { targets });
    if (accepted) setMultiSelectedSeats([]);
  });
};

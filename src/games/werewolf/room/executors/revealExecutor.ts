/**
 * revealExecutor — Handles 'reveal' ActionIntent
 *
 * Submits via confirmThenAct, then presents the reveal dialog from the
 * committed command snapshot via presentRevealAckDialog (the one dialog
 * presentation, shared with the state-driven re-entry effect in
 * useActionOrchestrator). Dismissing the dialog triggers
 * revealAckMutation.mutate; the mutation's isPending covers the
 * dialog-closed-but-ack-pending window the previous pendingRevealDialog
 * flag protected (gate logic in RoomInteractionPolicy via
 * useWerewolfPendingAcks).
 *
 * A snapshot without reveal data fails fast. 'alreadyPresented' is not an
 * error: the state-driven re-entry presented the same dialog first.
 */

import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { roomScreenLog } from '@/utils/logger';

import { presentRevealAckDialog } from './presentRevealAckDialog';
import type { IntentExecutor } from './types';

/** Handle reveal intent (display check result + ack). */
export const revealExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, confirmThenAct } = ctx;
  const { revealAckMutation, actionDialogs, revealAckGuard } = ctx;

  if (!intent.revealKind) {
    roomScreenLog.warn(' reveal intent missing revealKind');
    return;
  }

  const revealKind = intent.revealKind;

  confirmThenAct(intent.targetSeat, async (accepted) => {
    const state = toWerewolfLocalState(accepted.snapshot.state);
    const result = presentRevealAckDialog({
      state,
      schema: currentSchema,
      revealKind,
      claimKey: currentSchema?.id ?? revealKind,
      guard: revealAckGuard,
      revealAckMutation,
      actionDialogs,
    });
    if (result === 'missingRevealData') {
      throw new Error(
        `[FAIL-FAST] Successful ${revealKind} command snapshot is missing reveal data`,
      );
    }
  });
};

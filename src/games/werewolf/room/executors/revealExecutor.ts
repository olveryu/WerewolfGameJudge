/**
 * revealExecutor — Handles 'reveal' ActionIntent
 *
 * Submits via confirmThenAct, reads reveal data from the committed command
 * snapshot, shows the reveal dialog, and triggers revealAckMutation.mutate when the user
 * dismisses. The mutation's isPending covers the dialog-closed-but-ack-pending
 * window the previous pendingRevealDialog flag protected (gate logic in
 * RoomInteractionPolicy via useWerewolfPendingAcks).
 *
 * Failed acknowledgements reject the dialog action so the same attempt can be retried.
 */

import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { getRevealDataFromState } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

/** Handle reveal intent (display check result + ack). */
export const revealExecutor: IntentExecutor = (intent, ctx) => {
  const { currentSchema, confirmThenAct } = ctx;
  const { revealAckMutation, actionDialogs } = ctx;

  if (!intent.revealKind) {
    roomScreenLog.warn(' reveal intent missing revealKind');
    return;
  }

  const revealKind = intent.revealKind;

  confirmThenAct(intent.targetSeat, async (accepted) => {
    const state = toWerewolfLocalState(accepted.decision.snapshot.state);
    const reveal = getRevealDataFromState(state, revealKind);
    if (!reveal) {
      throw new Error(
        `[FAIL-FAST] Successful ${revealKind} command snapshot is missing reveal data`,
      );
    }

    const ui = currentSchema?.kind !== 'compound' ? currentSchema?.ui : undefined;
    const displayResult =
      ui?.revealResultFormat === 'factionCheck' ? reveal.result : getRoleDisplayName(reveal.result);
    const titlePrefix = ui?.revealTitlePrefix ?? revealKind;
    const revealTitle = `${titlePrefix}：${formatSeat(reveal.targetSeat)}是${displayResult}`;

    const attemptAck = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        revealAckMutation.mutate(undefined, {
          onSuccess: (result) => {
            if (!isSuccessfulRoomCommand(result)) {
              const reason = getRoomCommandFailureReason(result);
              roomScreenLog.warn('revealAck failed', { reason });
              reject(new Error(reason));
            } else {
              resolve();
            }
          },
          onError: (error) => {
            handleError(error, {
              label: '确认查验结果',
              logger: roomScreenLog,
              feedback: 'toast',
              alertMessage: '请稍后重试',
            });
            reject(error);
          },
        });
      });

    actionDialogs.showRevealDialog(revealTitle, '', attemptAck);
  });
};

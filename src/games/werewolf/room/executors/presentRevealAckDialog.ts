/**
 * presentRevealAckDialog — The one presentation of the reveal-ack dialog.
 *
 * Builds the dialog title from the schema ui + committed reveal data and
 * wires the dismiss button to the reveal-ack mutation. Moved verbatim out of
 * revealExecutor so both presentation paths share one implementation:
 * - revealExecutor (outcome-driven: right after the action commits), and
 * - useActionOrchestrator's state-driven re-entry effect (after a full-page
 *   reload the outcome snapshot is gone, but the ack is still pending in
 *   room state and progression stays frozen on it).
 *
 * Failed acknowledgements reject the dialog action so the same attempt can
 * be retried in the same dialog.
 *
 * The guard makes the two paths race-safe: whichever presents first claims
 * the ack episode; the other observes 'alreadyPresented' and does not stack
 * a second dialog. A claim is consumed only when the dialog is actually
 * shown — missing reveal data (deferred reveal not yet finalized) consumes
 * nothing, so a later state update can still present. Claims are cleared by
 * the orchestrator when no reveal ack is pending anymore.
 */

import type { ActionSchema, RevealKind } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type { UseMutationResult } from '@tanstack/react-query';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { UseRoomActionDialogsResult } from '@/games/werewolf/room/useRoomActionDialogs';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { getRevealDataFromState } from '../hooks/actionIntentHelpers';

/** One-shot claim set: at most one reveal dialog per pending-ack episode. */
export interface RevealAckPresentationGuard {
  /** Claim the presentation slot for an ack episode; false when already claimed. */
  claim(claimKey: string): boolean;
  /** Forget all claims (called when no reveal ack is pending anymore). */
  clear(): void;
}

/** Create the presentation guard owned by useActionOrchestrator. */
export function createRevealAckPresentationGuard(): RevealAckPresentationGuard {
  const claimed = new Set<string>();
  return {
    claim: (claimKey) => {
      if (claimed.has(claimKey)) return false;
      claimed.add(claimKey);
      return true;
    },
    clear: () => {
      claimed.clear();
    },
  };
}

/** Outcome of one presentation attempt. */
export type RevealAckPresentationResult = 'presented' | 'alreadyPresented' | 'missingRevealData';

/**
 * Show the reveal dialog for already-committed reveal data in `state`.
 * Dismissing the dialog sends the reveal ack via `revealAckMutation`.
 */
export function presentRevealAckDialog(args: {
  state: LocalGameState;
  schema: ActionSchema | null;
  revealKind: RevealKind;
  claimKey: string;
  guard: RevealAckPresentationGuard;
  revealAckMutation: UseMutationResult<WerewolfCommandDispatchOutcome, Error, void>;
  actionDialogs: UseRoomActionDialogsResult;
}): RevealAckPresentationResult {
  const { state, schema, revealKind, claimKey, guard, revealAckMutation, actionDialogs } = args;

  const reveal = getRevealDataFromState(state, revealKind);
  if (!reveal) return 'missingRevealData';
  if (!guard.claim(claimKey)) return 'alreadyPresented';

  const ui = schema?.kind !== 'compound' ? schema?.ui : undefined;
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
  return 'presented';
}

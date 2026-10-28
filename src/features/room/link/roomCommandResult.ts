/** Exhaustive readers for `DispatchOutcome`, shared by every room game's presenters. */

import type { CommittedCommandOutcome } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { DispatchOutcome } from '@/platform/realtime/types';

export type SuccessfulDispatchOutcome<TState extends BaseGameState<string>> = Extract<
  DispatchOutcome<TState>,
  { readonly kind: 'committed' }
> & { readonly outcome: Extract<CommittedCommandOutcome, { readonly kind: 'success' }> };

export function isSuccessfulRoomCommand<TState extends BaseGameState<string>>(
  result: DispatchOutcome<TState>,
): result is SuccessfulDispatchOutcome<TState> {
  return result.kind === 'committed' && result.outcome.kind === 'success';
}

/** Reason codes for the non-decision outcomes; all are translated in REASON_CODE_MAP. */
const DISPATCH_FAILURE_REASON = {
  unavailable: 'no_state',
  network: 'NETWORK_ERROR',
  timeout: 'TIMEOUT',
  server: 'SERVER_ERROR',
  cancelled: 'LINK_CANCELLED',
} as const;

/** The reason a non-successful outcome should be presented with. */
export function getRoomCommandFailureReason<TState extends BaseGameState<string>>(
  result: DispatchOutcome<TState>,
): string {
  switch (result.kind) {
    case 'committed':
      if (result.outcome.kind === 'domainRejected') return result.outcome.reason;
      throw new Error('[FAIL-FAST] Successful room command has no failure reason');
    case 'rejected':
      return result.reason;
    case 'unavailable':
      return DISPATCH_FAILURE_REASON.unavailable;
    case 'undelivered':
      return DISPATCH_FAILURE_REASON[result.cause];
    case 'cancelled':
      return DISPATCH_FAILURE_REASON.cancelled;
  }
}

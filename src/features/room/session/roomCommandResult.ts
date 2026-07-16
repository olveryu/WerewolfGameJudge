/** Exhaustive readers for the lossless room command delivery envelope. */

import type {
  CommittedCommandOutcome,
  RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCommandDispatchOutcome } from './types';

type CommittedRoomCommandResult<TState extends BaseGameState<string>> = Extract<
  RoomCommandResult<TState>,
  { readonly kind: 'committed' }
>;

export interface SuccessfulRoomCommandDispatchOutcome<TState extends BaseGameState<string>> {
  readonly kind: 'decided';
  readonly decision: Omit<CommittedRoomCommandResult<TState>, 'outcome'> & {
    readonly outcome: Extract<CommittedCommandOutcome, { readonly kind: 'success' }>;
  };
}

export function isSuccessfulRoomCommand<TState extends BaseGameState<string>>(
  result: RoomCommandDispatchOutcome<TState>,
): result is SuccessfulRoomCommandDispatchOutcome<TState> {
  return (
    result.kind === 'decided' &&
    result.decision.kind === 'committed' &&
    result.decision.outcome.kind === 'success'
  );
}

export function getRoomCommandFailureReason<TState extends BaseGameState<string>>(
  result: RoomCommandDispatchOutcome<TState>,
): string {
  if (result.kind !== 'decided') return result.reason;
  if (result.decision.kind === 'rejected') return result.decision.reason;
  if (result.decision.outcome.kind === 'domainRejected') {
    return result.decision.outcome.reason;
  }
  throw new Error('[FAIL-FAST] Successful room command has no failure reason');
}

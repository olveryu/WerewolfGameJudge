/** Validates a per-user terminal review acknowledgement against the displayed game. */

import type { CommandContext } from '../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_GAME_IN_PROGRESS,
  REASON_REVIEW_IDENTITY_MISMATCH,
  REASON_REVIEW_NOT_ELIGIBLE,
  REASON_USER_ACTOR_REQUIRED,
} from '../protocol/reasons';

export function resolveReviewCompletion<TIdentity extends string | number>(input: {
  readonly context: CommandContext;
  readonly isEnded: boolean;
  readonly currentIdentity: TIdentity;
  readonly expectedIdentity: TIdentity;
  readonly completedUserIds: readonly string[];
  readonly isEligible: (userId: string) => boolean;
}):
  | {
      readonly kind: 'reject';
      readonly reason:
        | typeof REASON_CONTROLLED_SEAT_NOT_ALLOWED
        | typeof REASON_GAME_IN_PROGRESS
        | typeof REASON_REVIEW_IDENTITY_MISMATCH
        | typeof REASON_REVIEW_NOT_ELIGIBLE
        | typeof REASON_USER_ACTOR_REQUIRED;
    }
  | { readonly kind: 'alreadyCompleted' }
  | { readonly kind: 'complete'; readonly userId: string } {
  const { context } = input;
  if (context.actor.kind !== 'user') {
    return { kind: 'reject', reason: REASON_USER_ACTOR_REQUIRED };
  }
  if (context.controlledSeat !== null) {
    return { kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED };
  }
  if (!input.isEnded) {
    return { kind: 'reject', reason: REASON_GAME_IN_PROGRESS };
  }
  if (input.currentIdentity !== input.expectedIdentity) {
    return { kind: 'reject', reason: REASON_REVIEW_IDENTITY_MISMATCH };
  }
  if (!input.isEligible(context.actor.userId)) {
    return { kind: 'reject', reason: REASON_REVIEW_NOT_ELIGIBLE };
  }
  return input.completedUserIds.includes(context.actor.userId)
    ? { kind: 'alreadyCompleted' }
    : { kind: 'complete', userId: context.actor.userId };
}

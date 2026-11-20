/** Validates a per-user terminal review acknowledgement against the displayed game. */

import type { CommandContext } from '../engine';

export function resolveReviewCompletion<TIdentity extends string | number>(input: {
  readonly context: CommandContext;
  readonly isEnded: boolean;
  readonly currentIdentity: TIdentity;
  readonly expectedIdentity: TIdentity;
  readonly completedUserIds: readonly string[];
  readonly isEligible: (userId: string) => boolean;
}):
  | { readonly kind: 'reject' }
  | { readonly kind: 'alreadyCompleted' }
  | { readonly kind: 'complete'; readonly userId: string } {
  const { context } = input;
  if (
    !input.isEnded ||
    input.currentIdentity !== input.expectedIdentity ||
    context.actor.kind !== 'user' ||
    context.controlledSeat !== null ||
    !input.isEligible(context.actor.userId)
  )
    return { kind: 'reject' };
  return input.completedUserIds.includes(context.actor.userId)
    ? { kind: 'alreadyCompleted' }
    : { kind: 'complete', userId: context.actor.userId };
}

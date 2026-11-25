import type { StepAction } from './actions';
import type { Availability } from './types';

export function getAvailability<TContext, TFacts, TResult>(
  action: StepAction<TContext, TFacts, TResult>,
  context: TContext,
  lockReason: string | null,
): Availability {
  const declaredAvailability = action.availability?.(context);
  if (declaredAvailability?.kind === 'hidden') return declaredAvailability;
  if (lockReason !== null && action.staysWhenLocked !== true) {
    return { kind: 'unavailable', reason: lockReason };
  }
  if (
    action.kind === 'direct' &&
    action.hideWithoutTarget === true &&
    (action.target?.(context) ?? null) === null
  ) {
    return { kind: 'hidden' };
  }
  return declaredAvailability ?? { kind: 'available' };
}

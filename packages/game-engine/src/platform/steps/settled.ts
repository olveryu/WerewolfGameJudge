import type { StepDefinition } from './step';
import { STEP_SKIP_ACTION_KEY } from './step';
import type { SeatRecord } from './types';

export function getSeatSettled<TStepId extends string, TContext, TFacts, TResult>(
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  context: TContext,
  record: SeatRecord<TResult>,
): boolean {
  if (definition.isSeatSettled !== undefined) return definition.isSeatSettled(context, record);
  return (
    hasFinalSubmission(definition, record) &&
    (record.result === null || record.isResultAcknowledged)
  );
}

/** Whether the seat has skipped or used an action that cannot be revised. */
export function hasFinalSubmission<TStepId extends string, TContext, TFacts, TResult>(
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  record: SeatRecord<TResult> | undefined,
): boolean {
  return (
    record?.submissions.some((submission) => {
      if (submission.actionKey === STEP_SKIP_ACTION_KEY) return true;
      const action = definition.actions.find((entry) => entry.key === submission.actionKey);
      return action !== undefined && action.commit !== 'revisable';
    }) === true
  );
}

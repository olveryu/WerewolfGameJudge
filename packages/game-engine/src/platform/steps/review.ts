import { formatSeat } from '../room/formatSeat';
import { renderCopy, STEP_COPY } from './copy';
import { createStepContext, type StepRuntime } from './runtime';
import type { StepDefinition } from './step';
import { STEP_SKIP_ACTION_KEY } from './step';
import type { SeatSubmission, StepReviewLine } from './types';

export function buildStepReviewLines<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
): readonly StepReviewLine[] {
  const slice = runtime.getSlice(state);
  const lines: StepReviewLine[] = [];
  for (const stepId of slice.order) {
    const definition = runtime.definitions[stepId];
    const record = slice.records[stepId] ?? { bySeat: {} };
    const context = createStepContext(runtime, state, null, record);
    for (const seat of definition.actors(context)) {
      const actorContext = createStepContext(runtime, state, seat, record);
      const seatRecord = record.bySeat[seat];
      if (definition.actions.some((action) => action.reviewWhenUnused === true)) {
        for (const action of definition.actions) {
          const submission = seatRecord?.submissions.find(
            (entry) => entry.actionKey === action.key,
          );
          if (submission === undefined && action.reviewWhenUnused === true) {
            lines.push(makeNotDoneLine(definition, actorContext, stepId, seat, action.name));
          } else if (submission !== undefined) {
            const line = makeActionLine(definition, action, actorContext, stepId, seat, submission);
            if (line !== null) lines.push(line);
          }
        }
        continue;
      }
      if (seatRecord === undefined || seatRecord.submissions.length === 0) {
        if (!definition.actions.every((action) => action.kind === 'view')) {
          lines.push(makeNotDoneLine(definition, actorContext, stepId, seat));
        }
        continue;
      }
      for (const submission of seatRecord.submissions) {
        const action = definition.actions.find((entry) => entry.key === submission.actionKey);
        if (action === undefined || submission.actionKey === STEP_SKIP_ACTION_KEY) {
          if (!definition.actions.every((entry) => entry.kind === 'view')) {
            lines.push(makeNotDoneLine(definition, actorContext, stepId, seat));
          }
          continue;
        }
        const line = makeActionLine(definition, action, actorContext, stepId, seat, submission);
        if (line !== null) lines.push(line);
      }
    }
  }
  return lines;
}

function makeNotDoneLine<TStepId extends string, TContext, TFacts, TResult>(
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  context: TContext,
  stepId: TStepId,
  seat: number,
  actionName = definition.actions[0]?.name ?? '',
): StepReviewLine {
  return {
    stepId,
    seat,
    text: `${definition.reviewSubject(context, seat)}${renderCopy(STEP_COPY.reviewNotDone, { name: actionName })}`,
  };
}

function makeActionLine<TStepId extends string, TContext, TFacts, TResult>(
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  action: import('./actions').StepAction<TContext, TFacts, TResult>,
  context: TContext,
  stepId: TStepId,
  seat: number,
  submission: SeatSubmission,
): StepReviewLine | null {
  const phrase = getSubmissionPhrase(action, submission, context);
  if (phrase === null) return null;
  const suffix = definition.reviewSuffix?.(context, submission) ?? '';
  return { stepId, seat, text: `${definition.reviewSubject(context, seat)}${phrase}${suffix}` };
}

function getSubmissionPhrase<TContext, TFacts, TResult>(
  action: import('./actions').StepAction<TContext, TFacts, TResult>,
  submission: SeatSubmission,
  context: TContext,
): string | null {
  if (action.kind === 'pickSeats') {
    return (
      action.phrase?.(submission.seats) ??
      `${action.name}${submission.seats.map(formatSeat).join(STEP_COPY.seatListSeparator)}`
    );
  }
  if (action.kind === 'direct') {
    const target = submission.seats[0];
    return target === undefined
      ? action.name
      : (action.phrase?.(target) ?? `${action.name}${formatSeat(target)}`);
  }
  if (action.kind === 'view') {
    return action.reviewPhrase === undefined ? action.name : action.reviewPhrase(context);
  }
  const card = action.cards(context).find((option) => option.index === submission.cardIndex);
  if (card === undefined) throw new Error('[FAIL-FAST] Review references a missing card');
  return action.phrase(card);
}

import type { AnyStepAction } from './actions';
import { getAvailability } from './availability';
import { createStepContext, type StepRuntime } from './runtime';
import { getSeatSettled } from './settled';
import type { StepEvent } from './state';
import { REASON_STEP_STALE, STEP_RESULT_ACK_ACTION_KEY, STEP_SKIP_ACTION_KEY } from './step';
import type { StepSubmission } from './types';
import type { Resolution } from './types';

export type StepSubmissionDecision<TStepId extends string, TFacts, TResult> =
  | { readonly kind: 'reject'; readonly reason: typeof REASON_STEP_STALE }
  | { readonly kind: 'accept'; readonly events: readonly StepEvent<TStepId, TFacts, TResult>[] };

export function decideStepSubmission<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  actorSeat: number,
  submission: StepSubmission,
): StepSubmissionDecision<TStepId, TFacts, TResult> {
  const slice = runtime.getSlice(state);
  if (
    slice.current === null ||
    slice.current.stepId !== submission.stepId ||
    slice.current.serial !== submission.serial
  ) {
    return rejectStale();
  }
  const definition = runtime.definitions[slice.current.stepId];
  const record = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const context = createStepContext(runtime, state, actorSeat, record);
  const actorRecord = record.bySeat[actorSeat];
  const actorsContext = createStepContext(runtime, state, null, record);
  if (!definition.actors(actorsContext).includes(actorSeat)) return rejectStale();

  if (submission.actionKey === STEP_RESULT_ACK_ACTION_KEY) {
    if (
      submission.seats !== undefined ||
      submission.cardIndex !== undefined ||
      actorRecord?.result === null ||
      actorRecord === undefined ||
      actorRecord.isResultAcknowledged
    ) {
      return rejectStale();
    }
    return {
      kind: 'accept',
      events: [
        {
          type: 'resultAcknowledged',
          stepId: slice.current.stepId,
          seat: actorSeat,
          actionKey: null,
        },
      ],
    };
  }
  if (actorRecord?.result != null && !actorRecord.isResultAcknowledged) return rejectStale();
  if (actorRecord !== undefined && getSeatSettled(definition, context, actorRecord)) {
    return rejectStale();
  }
  if (submission.actionKey === STEP_SKIP_ACTION_KEY) {
    if (submission.seats !== undefined || submission.cardIndex !== undefined) return rejectStale();
    return decideSkip(
      definition.skippable(context),
      definition.lock?.(context) ?? null,
      slice.current.stepId,
      actorSeat,
    );
  }
  const action = definition.actions.find((entry) => entry.key === submission.actionKey);
  if (action === undefined) return rejectStale();
  if (
    actorRecord?.submissions.some((entry) => entry.actionKey === action.key) &&
    action.commit !== 'revisable'
  ) {
    return rejectStale();
  }
  const replacesActionKeys = getReplacedActionKeys(definition.actions, action);
  const availability = getAvailability(action, context, definition.lock?.(context) ?? null);
  if (availability.kind !== 'available') return rejectStale();

  if (action.kind === 'view') {
    if (submission.seats !== undefined || submission.cardIndex !== undefined) return rejectStale();
    return {
      kind: 'accept',
      events: [
        {
          type: 'resultAcknowledged',
          stepId: slice.current.stepId,
          seat: actorSeat,
          actionKey: action.key,
        },
      ],
    };
  }
  if (action.kind === 'pickSeats') {
    const seats = submission.seats;
    if (seats === undefined || submission.cardIndex !== undefined) return rejectStale();
    if (
      seats.length < action.count.min ||
      seats.length > action.count.max ||
      new Set(seats).size !== seats.length
    ) {
      return rejectStale();
    }
    const options = action.seats(context);
    const legalSeats = new Set(runtime.seatedSeats(state));
    for (const seat of seats) {
      const option = options.find((entry) => entry.seat === seat);
      if (!legalSeats.has(seat) || option === undefined || option.unavailableReason !== null) {
        return rejectStale();
      }
    }
    return acceptResolution(
      slice.current.stepId,
      actorSeat,
      submission,
      action.resolve(context, seats),
      action.commit === 'revisable',
      replacesActionKeys,
    );
  }
  if (action.kind === 'direct') {
    if (submission.seats !== undefined || submission.cardIndex !== undefined) return rejectStale();
    const resolution = action.resolve(context);
    if (resolution.withdrawActionKey !== undefined) {
      if (resolution.facts !== undefined || resolution.result !== undefined) {
        throw new Error('[FAIL-FAST] A withdrawal cannot also emit facts or a result');
      }
      const previousAction = definition.actions.find(
        (entry) => entry.key === resolution.withdrawActionKey,
      );
      if (
        previousAction?.commit !== 'revisable' ||
        actorRecord?.submissions.some((entry) => entry.actionKey === previousAction.key) !== true
      ) {
        return rejectStale();
      }
      return {
        kind: 'accept',
        events: [
          {
            type: 'withdrawn',
            stepId: slice.current.stepId,
            seat: actorSeat,
            actionKey: previousAction.key,
          },
        ],
      };
    }
    const target = action.target?.(context) ?? null;
    return acceptResolution(
      slice.current.stepId,
      actorSeat,
      { ...submission, seats: target === null ? [] : [target] },
      resolution,
      action.commit === 'revisable',
      replacesActionKeys,
    );
  }
  if (submission.seats !== undefined || submission.cardIndex === undefined) return rejectStale();
  const card = action.cards(context).find((option) => option.index === submission.cardIndex);
  if (card === undefined || card.unavailableReason !== null) return rejectStale();
  return acceptResolution(
    slice.current.stepId,
    actorSeat,
    submission,
    action.resolve(context, card.index),
    action.commit === 'revisable',
    replacesActionKeys,
  );
}

function getReplacedActionKeys<TContext, TFacts, TResult>(
  actions: readonly AnyStepAction<TContext, TFacts, TResult>[],
  action: AnyStepAction<TContext, TFacts, TResult>,
): readonly string[] | undefined {
  if (action.revisionGroup === undefined) return undefined;
  const group = actions.filter((candidate) => candidate.revisionGroup === action.revisionGroup);
  if (group.some((candidate) => candidate.commit !== 'revisable')) {
    throw new Error(`[FAIL-FAST] Revision group ${action.revisionGroup} contains a final action`);
  }
  return group.map((candidate) => candidate.key);
}

function decideSkip<TStepId extends string, TFacts, TResult>(
  skippable: boolean,
  lockReason: string | null,
  stepId: TStepId,
  actorSeat: number,
): StepSubmissionDecision<TStepId, TFacts, TResult> {
  if (!skippable && lockReason === null) return rejectStale();
  return {
    kind: 'accept',
    events: [
      {
        type: 'submitted',
        stepId,
        seat: actorSeat,
        submission: { actionKey: STEP_SKIP_ACTION_KEY, seats: [], cardIndex: null },
        facts: {},
        result: null,
        revisable: false,
      },
    ],
  };
}

function acceptResolution<TStepId extends string, TFacts, TResult>(
  stepId: TStepId,
  actorSeat: number,
  submission: StepSubmission,
  resolution: Resolution<TFacts, TResult>,
  revisable: boolean,
  replacesActionKeys: readonly string[] | undefined,
): StepSubmissionDecision<TStepId, TFacts, TResult> {
  if (resolution.withdrawActionKey !== undefined) {
    throw new Error('[FAIL-FAST] Only a direct action can withdraw a submission');
  }
  return {
    kind: 'accept',
    events: [
      {
        type: 'submitted',
        stepId,
        seat: actorSeat,
        submission: {
          actionKey: submission.actionKey,
          seats: submission.seats ?? [],
          cardIndex: submission.cardIndex ?? null,
        },
        facts: resolution.facts ?? {},
        result: resolution.result ?? null,
        revisable,
        ...(replacesActionKeys === undefined ? {} : { replacesActionKeys }),
      },
    ],
  };
}

function rejectStale<TStepId extends string, TFacts, TResult>(): StepSubmissionDecision<
  TStepId,
  TFacts,
  TResult
> {
  return { kind: 'reject', reason: REASON_STEP_STALE };
}

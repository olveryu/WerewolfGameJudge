import { decideSettleCountdownArm, SETTLE_COUNTDOWN_MS } from '../room/settleCountdown';
import { getAvailability } from './availability';
import { createAdvanceEvent } from './presentation';
import { createStepContext, type StepRuntime } from './runtime';
import { getSeatSettled } from './settled';
import type { StepEvent } from './state';
import type { StepCompletion } from './step';
import type { StepSlice } from './types';

export { getSeatSettled } from './settled';

export function evaluateStepProgress<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  nowMs: number,
): readonly StepEvent<TStepId, TFacts, TResult>[] {
  const slice = runtime.getSlice(state);
  if (slice.current === null || runtime.isAudioPlaying(state)) return [];
  const definition = runtime.definitions[slice.current.stepId];
  const record = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const context = createStepContext(runtime, state, null, record);
  const actors = definition.actors(context);
  if (actors.length === 0 && definition.completion === undefined) {
    throw new Error(`[FAIL-FAST] Empty step ${definition.id} must declare a wait completion`);
  }
  const completion: StepCompletion = definition.completion?.(context) ?? {
    kind: actors.every((seat) => {
      const seatRecord = record.bySeat[seat];
      const seatContext = createStepContext(runtime, state, seat, record);
      return seatRecord !== undefined && getSeatSettled(definition, seatContext, seatRecord);
    })
      ? 'complete'
      : 'pending',
  };
  if (completion.kind === 'pending') {
    return slice.deadlineMs === null ? [] : [{ type: 'deadlineCleared' }];
  }
  if (completion.kind === 'complete') return [createAdvanceEvent(runtime, state)];
  if (completion.kind === 'waitUntil') {
    if (slice.deadlineMs === null || slice.deadlineMs !== completion.deadlineMs) {
      return [{ type: 'deadlineArmed', deadlineMs: completion.deadlineMs }];
    }
    return nowMs >= completion.deadlineMs ? [createAdvanceEvent(runtime, state)] : [];
  }
  return evaluateCountdown(runtime, state, slice, nowMs);
}

function evaluateCountdown<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  slice: StepSlice<TStepId, TResult>,
  nowMs: number,
): readonly StepEvent<TStepId, TFacts, TResult>[] {
  if (slice.current === null) return [];
  if (slice.deadlineMs !== null) {
    return nowMs >= slice.deadlineMs ? [createAdvanceEvent(runtime, state)] : [];
  }
  const arm = decideSettleCountdownArm({
    complete: true,
    armedDeadlineAt: null,
    nowMs,
    countdownMs: SETTLE_COUNTDOWN_MS,
  });
  return arm.type === 'set' ? [{ type: 'deadlineArmed', deadlineMs: arm.deadlineAt }] : [];
}

export function planBotAcknowledgements<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  botSeats: readonly number[],
): readonly StepEvent<TStepId, TFacts, TResult>[] {
  const slice = runtime.getSlice(state);
  if (slice.current === null) return [];
  const definition = runtime.definitions[slice.current.stepId];
  const record = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const actorsContext = createStepContext(runtime, state, null, record);
  const actors = new Set(definition.actors(actorsContext));
  const acknowledgements: StepEvent<TStepId, TFacts, TResult>[] = [];
  for (const seat of botSeats) {
    if (!actors.has(seat)) continue;
    const seatRecord = record.bySeat[seat];
    const context = createStepContext(runtime, state, seat, record);
    if (seatRecord !== undefined && getSeatSettled(definition, context, seatRecord)) {
      continue;
    }
    const viewAction = definition.actions.find((action) => {
      if (action.kind !== 'view') return false;
      return (
        getAvailability(action, context, definition.lock?.(context) ?? null).kind === 'available'
      );
    });
    if (viewAction?.kind !== 'view') continue;
    const hasAcknowledged = seatRecord?.submissions.some(
      (submission) => submission.actionKey === viewAction.key,
    );
    if (hasAcknowledged) continue;
    acknowledgements.push({
      type: 'resultAcknowledged',
      stepId: slice.current.stepId,
      seat,
      actionKey: viewAction.key,
    });
  }
  return acknowledgements;
}

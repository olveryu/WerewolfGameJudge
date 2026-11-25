import { decideSettleCountdownArm, SETTLE_COUNTDOWN_MS } from '../room/settleCountdown';
import { createAdvanceEvent } from './presentation';
import { createStepContext, type StepRuntime } from './runtime';
import { getSeatSettled } from './settled';
import type { StepEvent } from './state';
import type { StepCompletion } from './step';
import { decideStepSubmission } from './submission';
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
    throw new Error(`[FAIL-FAST] Step ${definition.id} has no actors and no completion rule`);
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

/** Acknowledge the open view of each bot seat through the same decision a player's tap takes. */
export function planBotAcknowledgements<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  botSeats: readonly number[],
): readonly StepEvent<TStepId, TFacts, TResult>[] {
  const slice = runtime.getSlice(state);
  if (slice.current === null) return [];
  const { stepId, serial } = slice.current;
  const viewKeys = runtime.definitions[stepId].actions
    .filter((action) => action.kind === 'view')
    .map((action) => action.key);
  const acknowledgements: StepEvent<TStepId, TFacts, TResult>[] = [];
  for (const seat of botSeats) {
    for (const actionKey of viewKeys) {
      const decision = decideStepSubmission(runtime, state, seat, { stepId, serial, actionKey });
      if (decision.kind !== 'accept') continue;
      acknowledgements.push(...decision.events);
      break;
    }
  }
  return acknowledgements;
}

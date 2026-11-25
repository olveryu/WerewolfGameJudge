import type { StepDefinition } from './step';
import type { StepRecord, StepSlice } from './types';

export interface StepRuntime<TStepId extends string, TState, TContext, TFacts, TResult> {
  readonly definitions: Readonly<
    Record<TStepId, StepDefinition<TStepId, TContext, TFacts, TResult>>
  >;
  readonly getSlice: (state: TState) => StepSlice<TStepId, TResult>;
  readonly getFacts: (state: TState) => TFacts;
  readonly createContext: (
    state: TState,
    facts: TFacts,
    seat: number | null,
    record: StepRecord<TResult>,
  ) => TContext;
  readonly isAudioPlaying: (state: TState) => boolean;
  readonly seatedSeats: (state: TState) => readonly number[];
}

export function createStepContext<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  seat: number | null,
  record: StepRecord<TResult>,
): TContext {
  return runtime.createContext(state, runtime.getFacts(state), seat, record);
}

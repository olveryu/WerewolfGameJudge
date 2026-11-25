import type { AnyStepAction } from './actions';
import type { SeatRecord, StepRecord } from './types';

export type StepCompletion =
  { readonly kind: 'pending' } | { readonly kind: 'complete' } | { readonly kind: 'armCountdown' };

export interface StepContextBase<TState, TFacts, TResult> {
  readonly state: TState;
  readonly facts: TFacts;
  readonly seat: number | null;
  readonly record: StepRecord<TResult>;
}

/** Why a seat's skills are all disabled: the reason on each greyed card and the status line. */
export interface StepLock {
  readonly reason: string;
  readonly status: string;
}

export interface StepDefinition<TStepId extends string, TContext, TFacts, TResult> {
  readonly id: TStepId;
  readonly title: string;
  readonly audio: (context: TContext) => {
    readonly begin: string | null;
    readonly end: string | null;
  };
  readonly actors: (context: TContext) => readonly number[];
  /** Marks a shared view that explicitly requires every seated player. */
  readonly audience?: 'allSeats';
  readonly progressActors?: (context: TContext) => readonly number[];
  readonly actions: readonly AnyStepAction<TContext, TFacts, TResult>[];
  readonly skippable: (context: TContext) => boolean;
  /** Every skill of the acting seat is disabled tonight; the seat can only skip. */
  readonly lock?: (context: TContext) => StepLock | null;
  readonly situationHints?: (context: TContext) => readonly string[];
  readonly ruleHints?: (context: TContext) => readonly string[];
  readonly renderResult?: (
    context: TContext,
    result: TResult,
  ) => { readonly title: string; readonly text: string };
  readonly reviewSubject: (context: TContext, seat: number) => string;
  readonly reviewSuffix?: (context: TContext, entry: SeatSubmissionForReview) => string | null;
  /** Replace the individual action lines with the step's own summary. */
  readonly reviewSummary?: (context: TContext) => readonly string[];
  readonly isSeatSettled?: (context: TContext, record: SeatRecord<TResult>) => boolean;
  readonly completion?: (context: TContext) => StepCompletion;
}

export interface SeatSubmissionForReview {
  readonly actionKey: string;
  readonly seats: readonly number[];
  readonly cardIndex: number | null;
}

export const STEP_SKIP_ACTION_KEY = '$skip';
export const STEP_RESULT_ACK_ACTION_KEY = '$resultAck';
export const REASON_STEP_STALE = 'REASON_STEP_STALE';

/** Explicit exceptions are the only supported overrides of default step progression. */
export const STEP_OVERRIDE_ALLOWLIST = {
  wolfKill: ['completion'],
  wolfRobotLearn: ['isSeatSettled'],
} as const;

import type { Availability, CardOption, Resolution, SeatOption } from './types';

interface ActionBase<TContext> {
  readonly key: string;
  readonly name: string;
  readonly availability?: (context: TContext) => Availability;
  readonly staysWhenLocked?: boolean;
  readonly commit?: 'final' | 'revisable';
}

export interface PickSeatsAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'pickSeats';
  readonly count: { readonly min: number; readonly max: number };
  readonly seats: (context: TContext) => readonly SeatOption[];
  readonly phrase?: (seats: readonly number[]) => string;
  readonly prompt?: string;
  readonly consequence?: (context: TContext, seats: readonly number[]) => string | null;
  readonly resolve: (context: TContext, seats: readonly number[]) => Resolution<TFacts, TResult>;
}

export interface DirectAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'direct';
  readonly target?: (context: TContext) => number | null;
  readonly phrase?: (seat: number) => string;
  readonly consequence?: (context: TContext) => string | null;
  readonly tone?: 'default' | 'danger';
  readonly resolve: (context: TContext) => Resolution<TFacts, TResult>;
}

export interface ViewAction<TContext> extends ActionBase<TContext> {
  readonly kind: 'view';
  readonly title: string;
  readonly content: (context: TContext) => string;
}

export interface PickCardAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'pickCard';
  readonly cards: (context: TContext) => readonly CardOption[];
  readonly hint?: (context: TContext) => string | null;
  readonly phrase: (card: CardOption) => string;
  readonly resolve: (context: TContext, cardIndex: number) => Resolution<TFacts, TResult>;
}

export type StepAction<TContext, TFacts, TResult> =
  | PickSeatsAction<TContext, TFacts, TResult>
  | DirectAction<TContext, TFacts, TResult>
  | ViewAction<TContext>
  | PickCardAction<TContext, TFacts, TResult>;

export type AnyStepAction<TContext, TFacts, TResult> = StepAction<TContext, TFacts, TResult>;

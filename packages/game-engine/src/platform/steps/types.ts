export type Availability =
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'hidden' };

export interface SeatOption {
  readonly seat: number;
  readonly unavailableReason: string | null;
}

export interface CardOption {
  readonly index: number;
  readonly label: string;
  readonly unavailableReason: string | null;
}

/** Facts and a private result emitted by a step action. */
export interface Resolution<TFacts, TResult> {
  readonly facts?: Partial<TFacts>;
  readonly result?: TResult;
  readonly withdrawActionKey?: string;
}

export interface SeatSubmission {
  readonly actionKey: string;
  readonly seats: readonly number[];
  readonly cardIndex: number | null;
}

export interface SeatRecord<TResult> {
  readonly submissions: readonly SeatSubmission[];
  readonly result: TResult | null;
  readonly isResultAcknowledged: boolean;
}

export interface StepRecord<TResult> {
  readonly bySeat: Readonly<Partial<Record<number, SeatRecord<TResult>>>>;
}

export interface StepPosition<TStepId extends string> {
  readonly stepId: TStepId;
  readonly serial: number;
}

export interface StepSlice<TStepId extends string, TResult> {
  readonly order: readonly TStepId[];
  readonly current: StepPosition<TStepId> | null;
  readonly records: Readonly<Partial<Record<TStepId, StepRecord<TResult>>>>;
  readonly deadlineMs: number | null;
}

export interface StepSubmission {
  readonly stepId: string;
  readonly serial: number;
  readonly actionKey: string;
  readonly seats?: readonly number[];
  readonly cardIndex?: number;
}

export interface StepReviewLine {
  readonly stepId: string;
  readonly seat: number;
  readonly text: string;
}

export interface PresentedActionBase {
  readonly key: string;
  readonly label: string;
  readonly availability: Availability;
}

export type PresentedAction =
  | (PresentedActionBase & {
      readonly kind: 'pickSeats';
      readonly min: number;
      readonly max: number;
      readonly seats: readonly SeatOption[];
      readonly committed: readonly number[] | null;
    })
  | (PresentedActionBase & { readonly kind: 'direct' })
  | (PresentedActionBase & {
      readonly kind: 'view';
      readonly content: { readonly title: string; readonly text: string };
      readonly isAcknowledged: boolean;
    })
  | (PresentedActionBase & {
      readonly kind: 'pickCard';
      readonly cards: readonly CardOption[];
      readonly hint: string | null;
    });

export interface StepPresentation {
  readonly stepId: string;
  readonly serial: number;
  readonly title: string;
  readonly message: string | null;
  readonly actions: readonly PresentedAction[];
  readonly pendingResult: { readonly title: string; readonly text: string } | null;
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly deadlineMs: number | null;
}

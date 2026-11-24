import type { AudioEffect } from '../audio/audioQueue';
import type { SeatSubmission, StepPosition, StepRecord, StepSlice } from './types';

export type StepEvent<TStepId extends string, TFacts, TResult> =
  | {
      readonly type: 'submitted';
      readonly stepId: TStepId;
      readonly seat: number;
      readonly submission: SeatSubmission;
      readonly facts: Partial<TFacts>;
      readonly result: TResult | null;
      readonly revisable: boolean;
    }
  | {
      readonly type: 'withdrawn';
      readonly stepId: TStepId;
      readonly seat: number;
      readonly actionKey: string;
    }
  | {
      readonly type: 'resultAcknowledged';
      readonly stepId: TStepId;
      readonly seat: number;
      readonly actionKey: string | null;
    }
  | { readonly type: 'deadlineArmed'; readonly deadlineMs: number }
  | { readonly type: 'deadlineCleared' }
  | {
      readonly type: 'advanced';
      readonly next: StepPosition<TStepId> | null;
      readonly audio: readonly AudioEffect[];
    };

export function evolveStepSlice<TStepId extends string, TResult, TFacts>(
  slice: StepSlice<TStepId, TResult>,
  event: StepEvent<TStepId, TFacts, TResult>,
): StepSlice<TStepId, TResult> {
  switch (event.type) {
    case 'submitted':
      return evolveSubmission(slice, event);
    case 'withdrawn':
      return evolveWithdrawal(slice, event);
    case 'resultAcknowledged':
      return evolveAcknowledgement(slice, event);
    case 'deadlineArmed':
      return { ...slice, deadlineMs: event.deadlineMs };
    case 'deadlineCleared':
      return { ...slice, deadlineMs: null };
    case 'advanced':
      return {
        ...slice,
        current: event.next,
        deadlineMs: null,
      };
  }
}

function evolveSubmission<TStepId extends string, TResult, TFacts>(
  slice: StepSlice<TStepId, TResult>,
  event: Extract<StepEvent<TStepId, TFacts, TResult>, { type: 'submitted' }>,
): StepSlice<TStepId, TResult> {
  const record = slice.records[event.stepId] ?? { bySeat: {} };
  const seatRecord = record.bySeat[event.seat] ?? {
    submissions: [],
    result: null,
    isResultAcknowledged: true,
  };
  const submissions = event.revisable
    ? [
        ...seatRecord.submissions.filter((entry) => entry.actionKey !== event.submission.actionKey),
        event.submission,
      ]
    : [...seatRecord.submissions, event.submission];
  const updated: StepRecord<TResult> = {
    bySeat: {
      ...record.bySeat,
      [event.seat]: {
        submissions,
        result: event.result,
        isResultAcknowledged: event.result === null,
      },
    },
  };
  return { ...slice, records: { ...slice.records, [event.stepId]: updated } };
}

function evolveWithdrawal<TStepId extends string, TResult, TFacts>(
  slice: StepSlice<TStepId, TResult>,
  event: Extract<StepEvent<TStepId, TFacts, TResult>, { type: 'withdrawn' }>,
): StepSlice<TStepId, TResult> {
  const record = slice.records[event.stepId];
  const seatRecord = record?.bySeat[event.seat];
  if (record === undefined || seatRecord === undefined) return slice;
  const updatedRecord = {
    ...seatRecord,
    submissions: seatRecord.submissions.filter((entry) => entry.actionKey !== event.actionKey),
  };
  return {
    ...slice,
    records: {
      ...slice.records,
      [event.stepId]: {
        bySeat: { ...record.bySeat, [event.seat]: updatedRecord },
      },
    },
  };
}

function evolveAcknowledgement<TStepId extends string, TResult, TFacts>(
  slice: StepSlice<TStepId, TResult>,
  event: Extract<StepEvent<TStepId, TFacts, TResult>, { type: 'resultAcknowledged' }>,
): StepSlice<TStepId, TResult> {
  const record = slice.records[event.stepId] ?? { bySeat: {} };
  const seatRecord = record.bySeat[event.seat] ?? {
    submissions: [],
    result: null,
    isResultAcknowledged: true,
  };
  const submissions =
    event.actionKey === null
      ? seatRecord.submissions
      : [
          ...seatRecord.submissions.filter((entry) => entry.actionKey !== event.actionKey),
          { actionKey: event.actionKey, seats: [], cardIndex: null },
        ];
  return {
    ...slice,
    records: {
      ...slice.records,
      [event.stepId]: {
        bySeat: {
          ...record.bySeat,
          [event.seat]: {
            ...seatRecord,
            submissions,
            isResultAcknowledged: true,
          },
        },
      },
    },
  };
}

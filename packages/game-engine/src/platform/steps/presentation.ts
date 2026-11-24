import { type AudioEffect, NIGHT_END_AUDIO_KEY } from '../audio/audioQueue';
import { formatSeat } from '../room/formatSeat';
import type { AnyStepAction } from './actions';
import { getAvailability } from './availability';
import { renderCopy, STEP_COPY } from './copy';
import { createStepContext, type StepRuntime } from './runtime';
import { getSeatSettled } from './settled';
import type { StepDefinition } from './step';
import { REASON_STEP_STALE, STEP_SKIP_ACTION_KEY } from './step';
import type {
  PresentedAction,
  SeatRecord,
  StepPresentation,
  StepRecord,
  StepSubmission,
} from './types';

export function presentStep<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  viewerSeat: number | null,
): StepPresentation | null {
  const slice = runtime.getSlice(state);
  if (slice.current === null) return null;
  const definition = runtime.definitions[slice.current.stepId];
  const record = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const actorRecord = viewerSeat === null ? undefined : record.bySeat[viewerSeat];
  const context = createStepContext(runtime, state, viewerSeat, record);
  const actorsContext = createStepContext(runtime, state, null, record);
  const actors = definition.actors(actorsContext);
  const isActor = viewerSeat !== null && actors.includes(viewerSeat);
  const lockReason = isActor ? (definition.lock?.(context) ?? null) : null;
  const hasPendingResult =
    actorRecord?.result !== null &&
    actorRecord?.result !== undefined &&
    !actorRecord.isResultAcknowledged;
  if (hasPendingResult && definition.renderResult === undefined) {
    throw new Error(`[FAIL-FAST] Step ${definition.id} has an unrenderable result`);
  }
  const pendingResult =
    hasPendingResult && definition.renderResult !== undefined
      ? definition.renderResult(context, actorRecord.result)
      : null;
  const actions =
    isActor &&
    viewerSeat !== null &&
    pendingResult === null &&
    (actorRecord === undefined || !getSeatSettled(definition, context, actorRecord))
      ? presentActions(definition, context, actorRecord, lockReason)
      : [];
  const generatedPrompt = isActor ? buildActionPrompt(definition, context, actions) : null;
  const message = isActor
    ? buildMessage(
        definition.situationHints?.(context) ?? [],
        generatedPrompt,
        definition.ruleHints?.(context) ?? [],
        definition.skippable(context) || lockReason !== null,
      )
    : null;
  const progress = getStepProgress(runtime, state, definition, record);
  return {
    stepId: definition.id,
    serial: slice.current.serial,
    title: definition.title,
    message,
    actions,
    pendingResult,
    progress,
    deadlineMs: slice.deadlineMs,
  };
}

function presentActions<TContext, TFacts, TResult>(
  definition: StepDefinition<string, TContext, TFacts, TResult>,
  context: TContext,
  actorRecord: SeatRecord<TResult> | undefined,
  lockReason: string | null,
): readonly PresentedAction[] {
  const actions = definition.actions.flatMap((action): readonly PresentedAction[] => {
    const alreadySubmitted =
      actorRecord?.submissions.some((entry) => entry.actionKey === action.key) === true &&
      action.commit !== 'revisable';
    const availability = alreadySubmitted
      ? { kind: 'unavailable' as const, reason: STEP_COPY.alreadySubmitted }
      : getAvailability(action, context, lockReason);
    if (availability.kind === 'hidden') return [];
    if (action.kind === 'pickSeats') {
      const prior = actorRecord?.submissions.find((entry) => entry.actionKey === action.key);
      return [
        {
          kind: action.kind,
          key: action.key,
          label: action.name,
          availability,
          min: action.count.min,
          max: action.count.max,
          seats: action.seats(context),
          committed: prior?.seats ?? null,
        },
      ];
    }
    if (action.kind === 'direct') {
      const target = action.target?.(context) ?? null;
      return [
        {
          kind: action.kind,
          key: action.key,
          label:
            target === null
              ? action.name
              : (action.phrase?.(target) ?? `${action.name}${formatSeat(target)}`),
          availability,
        },
      ];
    }
    if (action.kind === 'view') {
      const prior =
        actorRecord?.submissions.some((entry) => entry.actionKey === action.key) ?? false;
      return [
        {
          kind: action.kind,
          key: action.key,
          label: renderCopy(STEP_COPY.viewAction, { title: action.title }),
          availability,
          content: { title: action.title, text: action.content(context) },
          isAcknowledged: prior,
        },
      ];
    }
    return [
      {
        kind: action.kind,
        key: action.key,
        label: action.name,
        availability,
        cards: action.cards(context),
        hint: action.hint?.(context) ?? null,
      },
    ];
  });
  if (lockReason !== null || definition.skippable(context)) {
    const skipAction: PresentedAction = {
      kind: 'direct',
      key: STEP_SKIP_ACTION_KEY,
      label: STEP_COPY.skip,
      availability: { kind: 'available' },
    };
    return [...actions, skipAction];
  }
  return actions;
}

function buildActionPrompt<TStepId extends string, TContext, TFacts, TResult>(
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  context: TContext,
  actions: readonly PresentedAction[],
): string | null {
  const presentedPick = actions.find(
    (action) => action.kind === 'pickSeats' && action.availability.kind === 'available',
  );
  const pickAction = definition.actions.find(
    (action) => action.kind === 'pickSeats' && action.key === presentedPick?.key,
  );
  if (pickAction?.kind === 'pickSeats') {
    if (pickAction.prompt !== undefined) return pickAction.prompt;
    if (pickAction.count.min === 1 && pickAction.count.max === 1) {
      return renderCopy(STEP_COPY.chooseOne, { name: pickAction.name });
    }
    const range =
      pickAction.count.min === pickAction.count.max
        ? String(pickAction.count.max)
        : `${pickAction.count.min}-${pickAction.count.max}`;
    return renderCopy(
      pickAction.count.min === pickAction.count.max ? STEP_COPY.chooseExact : STEP_COPY.chooseRange,
      { name: range, action: pickAction.name },
    );
  }
  const presentedAction = actions.find((action) => action.availability.kind === 'available');
  if (presentedAction === undefined) return null;
  const prompt = definition.actions.find((action) => action.key === presentedAction.key);
  if (prompt?.kind === 'view') {
    return renderCopy(STEP_COPY.clickAction, { action: presentedAction.label });
  }
  return null;
}

function buildMessage(
  situationHints: readonly string[],
  generatedPrompt: string | null,
  ruleHints: readonly string[],
  skippable: boolean,
): string | null {
  const parts = [...situationHints];
  if (generatedPrompt !== null) {
    parts.push(
      skippable
        ? renderCopy(STEP_COPY.skippablePrompt, { prompt: generatedPrompt, skip: STEP_COPY.skip })
        : generatedPrompt,
    );
  }
  parts.push(...ruleHints);
  return parts.length === 0 ? null : parts.join(STEP_COPY.hintSeparator);
}

export function describeStepConfirmation<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  viewerSeat: number,
  selection: Pick<import('./types').StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
): { readonly title: string; readonly body: string | null; readonly tone: 'default' | 'danger' } {
  const slice = runtime.getSlice(state);
  if (slice.current === null) throw new Error(`[FAIL-FAST] ${REASON_STEP_STALE}`);
  const definition = runtime.definitions[slice.current.stepId];
  const record = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const context = createStepContext(runtime, state, viewerSeat, record);
  const action = definition.actions.find((entry) => entry.key === selection.actionKey);
  if (action === undefined) throw new Error(`[FAIL-FAST] ${REASON_STEP_STALE}`);
  const phrase = getConfirmationPhrase(action, selection, context);
  return {
    title: renderCopy(STEP_COPY.confirmationTitle, { phrase }),
    body: getConsequence(action, context, selection),
    tone: action.kind === 'direct' ? (action.tone ?? 'default') : 'default',
  };
}

function getConfirmationPhrase<TContext, TFacts, TResult>(
  action: AnyStepAction<TContext, TFacts, TResult>,
  selection: Pick<StepSubmission, 'seats' | 'cardIndex'>,
  context: TContext,
): string {
  if (action.kind === 'pickSeats') {
    const seats = selection.seats ?? [];
    return (
      action.phrase?.(seats) ??
      `${action.name}${seats.map(formatSeat).join(STEP_COPY.seatListSeparator)}`
    );
  }
  if (action.kind === 'direct') {
    const target = action.target?.(context) ?? null;
    return target === null
      ? action.name
      : (action.phrase?.(target) ?? `${action.name}${formatSeat(target)}`);
  }
  if (action.kind === 'view') return renderCopy(STEP_COPY.viewAction, { title: action.title });
  if (action.kind === 'pickCard') {
    const card = action.cards(context).find((option) => option.index === selection.cardIndex);
    if (card === undefined) throw new Error(`[FAIL-FAST] ${REASON_STEP_STALE}`);
    return action.phrase(card);
  }
  throw new Error('[FAIL-FAST] Unsupported step action');
}

function getConsequence<TContext, TFacts, TResult>(
  action: AnyStepAction<TContext, TFacts, TResult>,
  context: TContext,
  selection: Pick<StepSubmission, 'seats' | 'cardIndex'>,
): string | null {
  if (action.kind === 'pickSeats')
    return action.consequence?.(context, selection.seats ?? []) ?? null;
  if (action.kind === 'direct') return action.consequence?.(context) ?? null;
  return null;
}

export function createAdvanceEvent<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
): {
  readonly type: 'advanced';
  readonly next: import('./types').StepPosition<TStepId> | null;
  readonly audio: readonly AudioEffect[];
} {
  const slice = runtime.getSlice(state);
  if (slice.current === null) throw new Error('[FAIL-FAST] Cannot advance an inactive step');
  const currentDefinition = runtime.definitions[slice.current.stepId];
  const currentRecord = slice.records[slice.current.stepId] ?? { bySeat: {} };
  const currentContext = createStepContext(runtime, state, null, currentRecord);
  const currentIndex = slice.order.indexOf(slice.current.stepId);
  if (currentIndex < 0) throw new Error('[FAIL-FAST] Current step is absent from its order');
  const nextId = slice.order[currentIndex + 1] ?? null;
  const nextRecord = nextId === null ? { bySeat: {} } : (slice.records[nextId] ?? { bySeat: {} });
  const nextContext = createStepContext(runtime, state, null, nextRecord);
  const next = nextId === null ? null : { stepId: nextId, serial: slice.current.serial + 1 };
  const audio: AudioEffect[] = [];
  const currentEnd = currentDefinition.audio(currentContext).end;
  if (currentEnd !== null) audio.push({ audioKey: currentEnd, isEndAudio: true });
  if (next === null) audio.push({ audioKey: NIGHT_END_AUDIO_KEY, isEndAudio: true });
  else {
    const nextBegin = runtime.definitions[next.stepId].audio(nextContext).begin;
    if (nextBegin !== null) audio.push({ audioKey: nextBegin, isEndAudio: false });
  }
  return {
    type: 'advanced',
    next,
    audio,
  };
}

function getStepProgress<TStepId extends string, TState, TContext, TFacts, TResult>(
  runtime: StepRuntime<TStepId, TState, TContext, TFacts, TResult>,
  state: TState,
  definition: StepDefinition<TStepId, TContext, TFacts, TResult>,
  record: StepRecord<TResult>,
): { readonly done: number; readonly total: number } {
  const context = createStepContext(runtime, state, null, record);
  const actors = definition.actors(context);
  const done = actors.filter((seat) => {
    const seatRecord = record.bySeat[seat];
    const seatContext = createStepContext(runtime, state, seat, record);
    return seatRecord !== undefined && getSeatSettled(definition, seatContext, seatRecord);
  }).length;
  return { done, total: actors.length };
}

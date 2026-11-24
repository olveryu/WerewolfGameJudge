/** Drive Night-1 board scenarios through the production shared-step command. */

import {
  type GameState,
  GameStatus,
  getWerewolfViewModel,
  type SchemaId,
  type WerewolfActionInput,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type PresentedAction,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepPresentation,
  type StepSubmission,
} from '@game-judge/game-engine/platform/steps';

import type { GameContext, TestCommandExecution } from './gameContext';
import type { NightAction, NightActions } from './nightScript';

const MAX_NIGHT_TRANSITIONS = 300;

export type NightStepObserver = (context: GameContext, stepId: SchemaId) => void;

interface StepByStepResult {
  readonly deaths: number[];
  readonly completed: boolean;
}

function currentStepId(state: GameState): SchemaId | undefined {
  return state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : undefined;
}

function currentPresentation(state: GameState, seat: number): StepPresentation | null {
  return getWerewolfViewModel(state, { seat, isHost: seat === 0 }).step;
}

/** Submit the current shared-step command and return its actual command receipt. */
export function dispatchStep(
  context: GameContext,
  seat: number,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
  execution?: TestCommandExecution,
) {
  const state = context.getGameState();
  const current = state.nightState?.slice.current;
  if (current == null) throw new Error('[FAIL-FAST] No active spec-driven step');
  return context.dispatchAsSeat(
    seat,
    {
      type: 'werewolf.step.submit',
      gameSequence: state.gameSequence,
      submission: { ...current, ...selection },
    },
    execution,
  );
}

/** Submit the current shared-step command and require it to commit. */
export function submitStep(
  context: GameContext,
  seat: number,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
  description: string,
  execution?: TestCommandExecution,
): void {
  const state = context.getGameState();
  const current = state.nightState?.slice.current;
  if (current == null) throw new Error('[FAIL-FAST] No active spec-driven step');
  context.dispatchAsSeatOrThrow(
    seat,
    {
      type: 'werewolf.step.submit',
      gameSequence: state.gameSequence,
      submission: { ...current, ...selection },
    },
    description,
    execution,
  );
}

function requireAction(
  presentation: StepPresentation,
  predicate: (action: PresentedAction) => boolean,
): PresentedAction {
  const action = presentation.actions.find(
    (candidate) => candidate.availability.kind === 'available' && predicate(candidate),
  );
  if (action === undefined) {
    throw new Error(`[FAIL-FAST] No matching action in ${presentation.stepId}`);
  }
  return action;
}

/** Translate a scenario choice to a real shared-step submission for the current actor. */
export function submitActionOrThrow(
  context: GameContext,
  actorSeat: number,
  input: WerewolfActionInput,
  description: string | { readonly stepId?: SchemaId },
  execution?: TestCommandExecution,
): void {
  const state = context.getGameState();
  const view = currentPresentation(state, actorSeat);
  if (view?.isActor !== true) throw new Error('[FAIL-FAST] Scenario seat is not a step actor');
  const selection = submissionForInput(state, view, input);
  submitStep(
    context,
    actorSeat,
    selection,
    typeof description === 'string' ? description : `step ${description.stepId ?? view.stepId}`,
    execution,
  );
}

function submissionForInput(
  state: GameState,
  view: StepPresentation,
  input: WerewolfActionInput,
): Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'> {
  if (input.kind === 'skip' || (input.kind === 'target' && input.target === null)) {
    const key = view.stepId === 'wolfKill' ? 'wolfKillAbstain' : STEP_SKIP_ACTION_KEY;
    return { actionKey: requireAction(view, (action) => action.key === key).key };
  }
  if (input.kind === 'target' || input.kind === 'multiTarget') {
    const action = requireAction(view, (candidate) => candidate.kind === 'pickSeats');
    const seats = input.kind === 'target' ? [input.target] : input.targets;
    if (seats.some((seat) => seat === null)) throw new Error('[FAIL-FAST] Null target');
    return { actionKey: action.key, seats: seats.filter((seat) => seat !== null) };
  }
  if (input.kind === 'card') {
    const action = requireAction(view, (candidate) => candidate.kind === 'pickCard');
    return { actionKey: action.key, cardIndex: input.cardIndex };
  }
  if (input.kind === 'witch') {
    if (input.saveTarget !== null && input.poisonTarget !== null) {
      throw new Error('[FAIL-FAST] Witch cannot use both potions in one night');
    }
    if (input.saveTarget !== null) {
      if (state.nightState?.wolfKill?.target !== input.saveTarget) {
        throw new Error('[FAIL-FAST] Witch save target is not the wolf attack target');
      }
      return { actionKey: requireAction(view, (action) => action.key === 'antidote').key };
    }
    if (input.poisonTarget !== null) {
      return {
        actionKey: requireAction(view, (action) => action.key === 'poison').key,
        seats: [input.poisonTarget],
      };
    }
    return { actionKey: requireAction(view, (action) => action.key === STEP_SKIP_ACTION_KEY).key };
  }
  const action = requireAction(
    view,
    (candidate) => candidate.kind === 'view' || candidate.kind === 'direct',
  );
  return { actionKey: action.key };
}

function completeAudioOrDeadline(context: GameContext): boolean {
  const state = context.getGameState();
  if (state.isAudioPlaying) {
    context.acknowledgePendingAudioOrThrow('complete authoritative narration');
    return true;
  }
  const deadline = state.nightState?.slice.deadlineMs;
  if (deadline == null) return false;
  context.dispatchSystemOrThrow(
    { type: 'werewolf.phase.settleExpired' },
    'settle active night step',
    { nowMs: deadline },
  );
  return true;
}

function isRecordedWolfVote(state: GameState, seat: number): boolean {
  return (
    currentStepId(state) === 'wolfKill' &&
    (state.nightState?.slice.records.wolfKill?.bySeat[seat]?.submissions.length ?? 0) > 0
  );
}

function configuredInput(
  view: StepPresentation,
  value: NightAction | undefined,
): WerewolfActionInput {
  if (view.stepId === 'wolfKill') {
    return typeof value === 'number' ? { kind: 'target', target: value } : { kind: 'skip' };
  }
  const available = view.actions.filter((action) => action.availability.kind === 'available');
  if (
    available.some((action) => action.kind === 'view') &&
    !available.some((action) => action.kind === 'pickSeats' || action.kind === 'pickCard')
  ) {
    return { kind: 'confirm' };
  }
  if (
    view.stepId === 'seedWolfInfect' &&
    value === undefined &&
    available.some((action) => action.key === 'seedWolfInfect')
  ) {
    return { kind: 'confirm' };
  }
  if (typeof value === 'number') {
    return view.stepId === 'witchAction'
      ? { kind: 'witch', saveTarget: value, poisonTarget: null }
      : { kind: 'target', target: value };
  }
  if (value !== null && typeof value === 'object') {
    if ('cardIndex' in value) return { kind: 'card', cardIndex: value.cardIndex };
    if ('targets' in value) {
      return value.targets.length === 0
        ? { kind: 'skip' }
        : { kind: 'multiTarget', targets: value.targets };
    }
    if ('save' in value) {
      return { kind: 'witch', saveTarget: value.save, poisonTarget: value.poison };
    }
    return value.confirmed ? { kind: 'confirm' } : { kind: 'skip' };
  }
  const skip = view.actions.find(
    (action) => action.key === STEP_SKIP_ACTION_KEY && action.availability.kind === 'available',
  );
  if (skip !== undefined) return { kind: 'skip' };
  const card = view.actions.find(
    (action) => action.kind === 'pickCard' && action.availability.kind === 'available',
  );
  if (card?.kind === 'pickCard') {
    const available = card.cards.find((option) => option.unavailableReason === null);
    if (available === undefined) throw new Error('[FAIL-FAST] No selectable bottom card');
    return { kind: 'card', cardIndex: available.index };
  }
  const pick = view.actions.find(
    (action) => action.kind === 'pickSeats' && action.availability.kind === 'available',
  );
  if (pick?.kind === 'pickSeats') {
    const targets = pick.seats
      .filter((option) => option.unavailableReason === null)
      .slice(0, pick.min)
      .map((option) => option.seat);
    if (targets.length < pick.min) throw new Error('[FAIL-FAST] No eligible mandatory targets');
    return { kind: 'multiTarget', targets };
  }
  return { kind: 'confirm' };
}

function executeCurrentStep(
  context: GameContext,
  choices: NightActions,
  executions: Partial<Record<SchemaId, TestCommandExecution>>,
): void {
  const state = context.getGameState();
  const stepId = currentStepId(state);
  if (stepId === undefined) throw new Error('[FAIL-FAST] No current night step');
  const planStep = context.getNightPlan().steps.find((step) => step.stepId === stepId);
  if (planStep === undefined) throw new Error(`[FAIL-FAST] No planned step ${stepId}`);
  for (const seat of state.nightState?.roles.seatedSeats ?? []) {
    const view = currentPresentation(state, seat);
    if (view?.isActor !== true) continue;
    if (view.pendingResult !== null) {
      submitStep(context, seat, { actionKey: STEP_RESULT_ACK_ACTION_KEY }, `acknowledge ${stepId}`);
      return;
    }
    if (view.actions.length === 0 || isRecordedWolfVote(state, seat)) continue;
    let input = configuredInput(view, choices[planStep.roleId]);
    if (
      stepId === 'wolfKill' &&
      view.actions.find((action) => action.key === 'wolfKill')?.availability.kind !== 'available'
    ) {
      input = { kind: 'skip' };
    }
    submitActionOrThrow(context, seat, input, { stepId }, executions[stepId]);
    return;
  }
  throw new Error(`[FAIL-FAST] Night step ${stepId} has no actionable actor or deadline`);
}

/** Run until a named step is ready, without completing that step. */
export function executeStepsUntil(
  context: GameContext,
  targetStepId: SchemaId,
  choices: NightActions = {},
): boolean {
  for (let transition = 0; transition < MAX_NIGHT_TRANSITIONS; transition += 1) {
    const state = context.getGameState();
    if (state.isAudioPlaying) {
      context.acknowledgePendingAudioOrThrow(`complete narration before ${targetStepId}`);
      continue;
    }
    if (currentStepId(state) === targetStepId) return true;
    if (state.status === GameStatus.Day || state.status === GameStatus.Ended) return false;
    if (state.status !== GameStatus.Ongoing) {
      throw new Error(`[FAIL-FAST] Night runner received lifecycle ${state.status}`);
    }
    if (!completeAudioOrDeadline(context)) executeCurrentStep(context, choices, {});
  }
  throw new Error(`[FAIL-FAST] Night exceeded ${MAX_NIGHT_TRANSITIONS} transitions`);
}

/** Finish the current night using the supplied role choices. */
export function executeRemainingSteps(
  context: GameContext,
  choices: NightActions = {},
  observeStep?: NightStepObserver,
  executions: Partial<Record<SchemaId, TestCommandExecution>> = {},
): StepByStepResult {
  const observed = new Set<SchemaId>();
  for (let transition = 0; transition < MAX_NIGHT_TRANSITIONS; transition += 1) {
    const state = context.getGameState();
    if (state.isAudioPlaying) {
      context.acknowledgePendingAudioOrThrow('complete authoritative narration');
      continue;
    }
    if (state.status === GameStatus.Day || state.status === GameStatus.Ended) {
      return { deaths: state.lastNightDeaths ?? [], completed: true };
    }
    if (state.status !== GameStatus.Ongoing) {
      throw new Error(`[FAIL-FAST] Night runner received lifecycle ${state.status}`);
    }
    const stepId = currentStepId(state);
    if (stepId === undefined) throw new Error('[FAIL-FAST] Missing live night step');
    if (!observed.has(stepId)) {
      observeStep?.(context, stepId);
      observed.add(stepId);
    }
    if (!completeAudioOrDeadline(context)) executeCurrentStep(context, choices, executions);
  }
  throw new Error(`[FAIL-FAST] Night exceeded ${MAX_NIGHT_TRANSITIONS} transitions`);
}

/** Finish a full night using the supplied role choices. */
export function executeFullNight(
  context: GameContext,
  choices: NightActions = {},
  observeStep?: NightStepObserver,
  executions: Partial<Record<SchemaId, TestCommandExecution>> = {},
): StepByStepResult {
  return executeRemainingSteps(context, choices, observeStep, executions);
}

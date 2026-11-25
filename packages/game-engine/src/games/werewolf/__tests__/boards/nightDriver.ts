import {
  describeWerewolfStepConfirmation,
  type GameState,
  GameStatus,
  getWerewolfDaytimeAnnouncements,
  getWerewolfNightReview,
  getWerewolfViewModel,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type PresentedAction,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepPresentation,
} from '@game-judge/game-engine/platform/steps';

import { formatSeat } from '../../../../platform/room/formatSeat';
import { getWerewolfRoleDefinition } from '../../roles/nightPlan';
import type { GameContext, TestCommandExecution } from './gameContext';
import type { NightAction, NightActions } from './nightScript';

const TRANSITION_LIMIT = 300;

/** One submission addressed by its action key, as the client sends it. */
export interface StepChoice {
  readonly actionKey: string;
  readonly seats?: readonly number[];
  readonly cardIndex?: number;
}

/** Step-keyed choices; a step without an entry takes its default action. */
export type StepChoices = Readonly<Record<string, StepChoice>>;

type ChoicePicker = (stepId: string, view: StepPresentation, seat: number) => StepChoice;

/** Everything a full night showed and produced, in the words players read. */
export interface NightOutcome {
  readonly steps: readonly string[];
  /** The status line each actor read on first seeing the step. */
  readonly status: readonly string[];
  readonly unavailable: readonly string[];
  readonly views: readonly string[];
  readonly review: readonly string[];
  readonly deaths: readonly string[];
  readonly announcements: readonly string[];
}

/** What one actor was shown on reaching a step, before choosing anything. */
export interface StepSighting {
  readonly stepId: string;
  readonly seat: number;
  /** The role the actor holds at that moment. */
  readonly roleName: string;
  /** True when the actor has already acted in this step and is shown a new hand. */
  readonly isFollowUp: boolean;
  /** The step's name, shown above the hand. */
  readonly title: string;
  readonly status: string | null;
  readonly hand: readonly string[];
}

/** One submission as the actor experienced it. */
export interface StepSubmissionSighting {
  readonly stepId: string;
  readonly seat: number;
  readonly roleName: string;
  /** The card pressed and what was picked with it. */
  readonly action: string;
  /** The confirmation dialog; null for a card that only shows content. */
  readonly confirmation: string | null;
  /** The result shown afterwards, when the action has one. */
  readonly result: string | null;
  /** The status line and hand left after the submission, when the actor may still act. */
  readonly after: readonly string[];
}

/** A played night: the snapshot outcome plus everything each actor was shown. */
export interface NightRun {
  readonly outcome: NightOutcome;
  readonly sightings: readonly StepSighting[];
  readonly submissions: readonly StepSubmissionSighting[];
  /** The night report, each sentence with the step it belongs to, if any. */
  readonly reviewLines: readonly { readonly stepId: string | null; readonly text: string }[];
  /** The cards individual seats may open the next day. */
  readonly daytimeViews: readonly string[];
}

interface NightObserver {
  readonly onStep: (stepId: string) => void;
  readonly onPresentation: (
    stepId: string,
    seat: number,
    view: StepPresentation,
    isFollowUp: boolean,
  ) => void;
  readonly onSubmit: (
    stepId: string,
    seat: number,
    view: StepPresentation,
    choice: StepChoice,
    before: GameState,
    after: GameState,
  ) => void;
  readonly onResult: (
    stepId: string,
    seat: number,
    result: NonNullable<StepPresentation['pendingResult']>,
  ) => void;
  readonly onView: (stepId: string, seat: number, text: string) => void;
}

export function currentStep(state: GameState): {
  readonly stepId: string;
  readonly serial: number;
} {
  const current = state.nightState?.slice.current;
  if (current == null) throw new Error('[FAIL-FAST] Expected an active spec-driven night step');
  return current;
}

export function submit(
  context: GameContext,
  seat: number,
  choice: StepChoice,
  execution?: TestCommandExecution,
): void {
  const state = context.getGameState();
  context.dispatchAsSeatOrThrow(
    seat,
    {
      type: 'werewolf.step.submit',
      gameSequence: state.gameSequence,
      submission: { ...currentStep(state), ...choice },
    },
    `submit ${choice.actionKey} at seat ${seat}`,
    execution,
  );
}

export function presentation(state: GameState, seat: number): StepPresentation | null {
  return getWerewolfViewModel(state, { seat, isHost: seat === 0 }).step;
}

function availableActions(view: StepPresentation): readonly PresentedAction[] {
  return view.actions.filter((action) => action.availability.kind === 'available');
}

function defaultSeats(action: PresentedAction & { readonly kind: 'pickSeats' }): number[] {
  const seats = action.seats
    .filter((option) => option.unavailableReason === null)
    .slice(0, action.min)
    .map((option) => option.seat);
  if (seats.length < action.min) throw new Error('[FAIL-FAST] Not enough eligible targets');
  return seats;
}

function defaultCard(action: PresentedAction & { readonly kind: 'pickCard' }): number {
  const cardIndex = action.cards.find((card) => card.unavailableReason === null)?.index;
  if (cardIndex === undefined) throw new Error('[FAIL-FAST] No eligible bottom card');
  return cardIndex;
}

function pickStepChoice(view: StepPresentation, choice: StepChoice | undefined): StepChoice {
  const available = availableActions(view);
  const action =
    choice === undefined
      ? (available.find((candidate) => candidate.key === STEP_SKIP_ACTION_KEY) ??
        available.find((candidate) => candidate.key === 'wolfKillAbstain') ??
        available[0])
      : available.find((candidate) => candidate.key === choice.actionKey);
  if (action === undefined) {
    throw new Error(`[FAIL-FAST] No available ${choice?.actionKey ?? 'default'} action`);
  }
  if (action.kind === 'pickSeats') {
    return { actionKey: action.key, seats: choice?.seats ?? defaultSeats(action) };
  }
  if (action.kind === 'pickCard') {
    return { actionKey: action.key, cardIndex: choice?.cardIndex ?? defaultCard(action) };
  }
  return { actionKey: action.key };
}

function chosenSeats(choice: NightAction | undefined): readonly number[] {
  if (typeof choice === 'number') return [choice];
  if (choice !== null && typeof choice === 'object' && 'targets' in choice) return choice.targets;
  return [];
}

function pickWitchChoice(
  available: readonly PresentedAction[],
  choice: NightAction | undefined,
): StepChoice {
  const has = (key: string): boolean => available.some((action) => action.key === key);
  const wantsAntidote =
    typeof choice === 'number' ||
    (choice !== null && typeof choice === 'object' && 'save' in choice && choice.save !== null);
  if (wantsAntidote && has('antidote')) return { actionKey: 'antidote' };
  if (
    !wantsAntidote &&
    choice !== null &&
    typeof choice === 'object' &&
    'poison' in choice &&
    choice.poison !== null &&
    has('poison')
  ) {
    return { actionKey: 'poison', seats: [choice.poison] };
  }
  return { actionKey: STEP_SKIP_ACTION_KEY };
}

/** Translate one role-keyed scenario choice into the submission the current view allows. */
function pickScenarioChoice(
  stepId: string,
  view: StepPresentation,
  choice: NightAction | undefined,
  seat: number,
): StepChoice {
  const available = availableActions(view);
  if (stepId === 'wolfKill') {
    const target =
      choice !== null && typeof choice === 'object' && 'votesBySeat' in choice
        ? choice.votesBySeat[seat]
        : choice;
    return typeof target === 'number' && available.some((action) => action.key === 'wolfKill')
      ? { actionKey: 'wolfKill', seats: [target] }
      : { actionKey: 'wolfKillAbstain' };
  }
  if (stepId === 'witchAction') return pickWitchChoice(available, choice);

  const primary = available.find((action) => action.key !== STEP_SKIP_ACTION_KEY);
  const isSkippable = available.some((action) => action.key === STEP_SKIP_ACTION_KEY);
  if (primary === undefined) {
    if (!isSkippable) throw new Error(`[FAIL-FAST] ${stepId} offers no available action`);
    return { actionKey: STEP_SKIP_ACTION_KEY };
  }
  if (primary.kind === 'view') return { actionKey: primary.key };
  if (primary.kind === 'pickCard') {
    const cardIndex =
      choice !== null && typeof choice === 'object' && 'cardIndex' in choice
        ? choice.cardIndex
        : defaultCard(primary);
    return { actionKey: primary.key, cardIndex };
  }
  if (primary.kind === 'pickSeats') {
    const seats = chosenSeats(choice);
    if (seats.length > 0) return { actionKey: primary.key, seats };
    return isSkippable
      ? { actionKey: STEP_SKIP_ACTION_KEY }
      : { actionKey: primary.key, seats: defaultSeats(primary) };
  }
  const isDeclined =
    choice !== null && typeof choice === 'object' && 'confirmed' in choice && !choice.confirmed;
  if (isDeclined && !isSkippable) throw new Error(`[FAIL-FAST] ${stepId} cannot be declined`);
  return { actionKey: isDeclined ? STEP_SKIP_ACTION_KEY : primary.key };
}

function findStepRole(state: GameState, stepId: string): RoleId {
  if (stepId === 'wolfKill') return 'wolf';
  const role = state.templateRoles.find((roleId) =>
    getWerewolfRoleDefinition(roleId).steps.some((step) => step.id === stepId),
  );
  if (role === undefined) throw new Error(`[FAIL-FAST] Step ${stepId} has no role`);
  return role;
}

function actOneSeat(
  context: GameContext,
  pick: ChoicePicker,
  submitted: Set<string>,
  observer: NightObserver | null,
  execution: TestCommandExecution | undefined,
): boolean {
  const state = context.getGameState();
  const current = currentStep(state);
  for (const seat of state.nightState?.roles.seatedSeats ?? []) {
    const view = presentation(state, seat);
    if (view?.isActor !== true) continue;
    if (view.pendingResult !== null) {
      observer?.onResult(current.stepId, seat, view.pendingResult);
      submit(context, seat, { actionKey: STEP_RESULT_ACK_ACTION_KEY }, execution);
      return true;
    }
    if (view.actions.length === 0) continue;
    const position = `${current.stepId}:${current.serial}:${seat}`;
    const choice = pick(current.stepId, view, seat);
    const submissionKey = `${position}:${choice.actionKey}`;
    if (submitted.has(submissionKey)) continue;
    observer?.onPresentation(current.stepId, seat, view, submitted.has(position));
    const action = view.actions.find((candidate) => candidate.key === choice.actionKey);
    if (action?.kind === 'view') {
      if (action.content === null) throw new Error(`[FAIL-FAST] ${action.key} cannot be opened`);
      observer?.onView(current.stepId, seat, action.content.text);
    }
    submitted.add(position);
    submitted.add(submissionKey);
    submit(context, seat, choice, execution);
    observer?.onSubmit(current.stepId, seat, view, choice, state, context.getGameState());
    return true;
  }
  return false;
}

/** Advance the night through production commands; returns whether `stopAtStepId` was reached. */
function drive(
  context: GameContext,
  pick: ChoicePicker,
  options: {
    readonly stopAtStepId?: string;
    readonly observer?: NightObserver;
    readonly execution?: TestCommandExecution;
  } = {},
): boolean {
  const submitted = new Set<string>();
  let observedStep: string | null = null;
  for (let transition = 0; transition < TRANSITION_LIMIT; transition += 1) {
    const state = context.getGameState();
    if (state.isAudioPlaying) {
      context.acknowledgePendingAudioOrThrow('complete night narration');
      continue;
    }
    if (state.status !== GameStatus.Ongoing) return false;
    const { stepId } = currentStep(state);
    if (stepId === options.stopAtStepId) return true;
    if (stepId !== observedStep) {
      observedStep = stepId;
      options.observer?.onStep(stepId);
    }
    const deadline = state.nightState?.slice.deadlineMs;
    if (deadline != null) {
      context.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'settle night step', {
        nowMs: deadline,
      });
      continue;
    }
    if (!actOneSeat(context, pick, submitted, options.observer ?? null, options.execution)) {
      throw new Error(`[FAIL-FAST] Night step ${stepId} cannot progress`);
    }
  }
  throw new Error('[FAIL-FAST] Spec-driven night exceeded its transition limit');
}

/** Play the whole night with step-keyed choices. */
export function driveNight(context: GameContext, choices: StepChoices): void {
  drive(context, (stepId, view) => pickStepChoice(view, choices[stepId]));
}

/** Play until `targetStepId` becomes current; false when the night ends first. */
export function executeStepsUntil(
  context: GameContext,
  targetStepId: string,
  choices: StepChoices,
): boolean {
  return drive(context, (stepId, view) => pickStepChoice(view, choices[stepId]), {
    stopAtStepId: targetStepId,
  });
}

function describeUnavailable(view: StepPresentation): readonly string[] {
  const lines: string[] = [];
  for (const action of view.actions) {
    if (action.availability.kind === 'unavailable') {
      lines.push(`${action.label}: ${action.availability.reason}`);
    }
    const options =
      action.kind === 'pickSeats'
        ? action.seats.map((option) => ({
            name: formatSeat(option.seat),
            reason: option.unavailableReason,
          }))
        : action.kind === 'pickCard'
          ? action.cards.map((card) => ({ name: card.label, reason: card.unavailableReason }))
          : [];
    const namesByReason = new Map<string, string[]>();
    for (const option of options) {
      if (option.reason === null) continue;
      namesByReason.set(option.reason, [...(namesByReason.get(option.reason) ?? []), option.name]);
    }
    for (const [reason, names] of namesByReason) {
      lines.push(`${action.label} ${names.join(' ')}: ${reason}`);
    }
  }
  return lines;
}

/** The hand as the actor reads it: one line per card, with what it offers and what it refuses. */
function describeHand(view: StepPresentation): readonly string[] {
  const lines: string[] = [];
  for (const action of view.actions) {
    let card = action.label;
    if (action.kind === 'pickSeats') {
      const count = action.min === action.max ? `${action.min}` : `${action.min}–${action.max}`;
      card += `（选 ${count} 名）`;
      if (action.committed !== null && action.committed.length > 0) {
        card += `，已选 ${action.committed.map((seat) => formatSeat(seat)).join(' ')}`;
      }
    }
    if (action.availability.kind === 'unavailable') {
      card += `（不可用：${action.availability.reason}）`;
    }
    lines.push(`· ${card}`);
    if (action.kind === 'view' && action.content !== null) {
      lines.push(`  内容「${action.content.title}」${action.content.text}`);
    }
    if (action.kind === 'pickCard') {
      if (action.hint !== null) lines.push(`  提示：${action.hint}`);
      const cards = action.cards.map((option) =>
        option.unavailableReason === null
          ? option.label
          : `${option.label}（不可选：${option.unavailableReason}）`,
      );
      lines.push(`  底牌：${cards.join('、')}`);
    }
    if (action.kind === 'pickSeats') {
      const namesByReason = new Map<string, string[]>();
      for (const option of action.seats) {
        if (option.unavailableReason === null) continue;
        namesByReason.set(option.unavailableReason, [
          ...(namesByReason.get(option.unavailableReason) ?? []),
          formatSeat(option.seat),
        ]);
      }
      for (const [reason, names] of namesByReason) {
        lines.push(`  不可选 ${names.join(' ')}：${reason}`);
      }
    }
  }
  return lines;
}

/** The card pressed and what was picked with it. */
function describeChoice(view: StepPresentation, choice: StepChoice): string {
  const action = view.actions.find((candidate) => candidate.key === choice.actionKey);
  if (action === undefined) throw new Error(`[FAIL-FAST] ${choice.actionKey} is not in the hand`);
  if (choice.seats !== undefined && choice.seats.length > 0) {
    return `${action.label} → ${choice.seats.map((seat) => formatSeat(seat)).join(' ')}`;
  }
  if (action.kind === 'pickCard') {
    const card = action.cards.find((option) => option.index === choice.cardIndex);
    if (card === undefined) throw new Error(`[FAIL-FAST] Card ${choice.cardIndex} is not offered`);
    return `${action.label} → ${card.label}`;
  }
  return action.label;
}

function roleNameAt(state: GameState, seat: number): string {
  const roleId = state.nightState?.roles.identities[seat]?.currentRole;
  if (roleId === undefined) throw new Error(`[FAIL-FAST] Seat ${seat} holds no role tonight`);
  return getWerewolfRoleDefinition(roleId).card.name;
}

/** The cards seats may open the next day, read as if the host had published the deaths. */
function describeDaytimeViews(state: GameState): readonly string[] {
  const published: GameState = { ...state, lastNightInfoConfirmed: true };
  return (state.nightState?.roles.seatedSeats ?? []).flatMap((seat) =>
    getWerewolfViewModel(published, { seat, isHost: false }).personalDaytimeViews.map(
      (view) =>
        `${formatSeat(seat)}${roleNameAt(state, seat)} · ${view.label}（${view.prompt}）→「${view.title}」${view.text}`,
    ),
  );
}

function groupBySeats(entries: ReadonlyMap<string, readonly number[]>): string[] {
  return [...entries].map(
    ([text, seats]) => `${text} [${seats.map((seat) => formatSeat(seat)).join(' ')}]`,
  );
}

function appendSeat(entries: Map<string, number[]>, key: string, seat: number): void {
  entries.set(key, [...(entries.get(key) ?? []), seat]);
}

/** Play the whole night with role-keyed scenario choices and report what players saw. */
export function playScenarioNight(
  context: GameContext,
  choices: NightActions,
  randomSeed?: string,
): NightRun {
  const steps: string[] = [];
  const status = new Map<string, number[]>();
  const unavailable = new Map<string, number[]>();
  const views = new Map<string, number[]>();
  const sightings: StepSighting[] = [];
  const submissions: {
    stepId: string;
    seat: number;
    roleName: string;
    action: string;
    confirmation: string | null;
    result: string | null;
    after: readonly string[];
  }[] = [];
  drive(
    context,
    (stepId, view, seat) => {
      const state = context.getGameState();
      const roleId = findStepRole(state, stepId);
      return pickScenarioChoice(stepId, view, choices[roleId], seat);
    },
    {
      observer: {
        onStep: (stepId) => steps.push(stepId),
        onPresentation: (stepId, seat, view, isFollowUp) => {
          sightings.push({
            stepId,
            seat,
            roleName: roleNameAt(context.getGameState(), seat),
            isFollowUp,
            title: view.title,
            status: view.message,
            hand: describeHand(view),
          });
          if (isFollowUp) return;
          if (view.message !== null) appendSeat(status, `${stepId} ${view.message}`, seat);
          for (const line of describeUnavailable(view)) {
            appendSeat(unavailable, `${stepId} ${line}`, seat);
          }
        },
        onSubmit: (stepId, seat, view, choice, before, after) => {
          const pressed = view.actions.find((candidate) => candidate.key === choice.actionKey);
          const dialog =
            pressed?.kind === 'view'
              ? null
              : describeWerewolfStepConfirmation(before, seat, choice);
          const isSameStep =
            after.status === GameStatus.Ongoing &&
            after.nightState?.slice.current?.stepId === stepId;
          const next = isSameStep ? presentation(after, seat) : null;
          const hasHandLeft =
            next !== null && next.pendingResult === null && next.actions.length > 0;
          submissions.push({
            stepId,
            seat,
            roleName: roleNameAt(before, seat),
            action: describeChoice(view, choice),
            confirmation:
              dialog === null
                ? null
                : dialog.body === null
                  ? dialog.title
                  : `${dialog.title}（${dialog.body}）`,
            result: null,
            after: hasHandLeft
              ? [
                  ...(next.message === null ? [] : [`状态栏：${next.message}`]),
                  ...describeHand(next),
                ]
              : [],
          });
        },
        onResult: (stepId, seat, result) => {
          const submission = submissions.findLast(
            (entry) => entry.stepId === stepId && entry.seat === seat,
          );
          if (submission === undefined) {
            throw new Error(`[FAIL-FAST] ${stepId} showed seat ${seat} a result for no submission`);
          }
          submission.result = `「${result.title}」${result.text}`;
        },
        onView: (stepId, seat, text) => appendSeat(views, `${stepId} ${text}`, seat),
      },
      ...(randomSeed === undefined ? {} : { execution: { randomSeed } }),
    },
  );

  const state = context.getGameState();
  const reviewLines = getWerewolfNightReview(state).lines.map((line) =>
    line.kind === 'action'
      ? {
          stepId: line.stepId,
          text: `${formatSeat(line.seat)}${line.subject}${line.phrase}${line.result ?? ''}`,
        }
      : { stepId: line.stepId, text: line.text },
  );
  return {
    outcome: {
      steps,
      status: groupBySeats(status),
      unavailable: groupBySeats(unavailable),
      views: groupBySeats(views),
      review: reviewLines.map((line) => line.text),
      deaths: (state.lastNightDeaths ?? []).map(
        (seat) => `${formatSeat(seat)} ${state.deathReasons?.[seat] ?? 'unknown'}`,
      ),
      announcements: getWerewolfDaytimeAnnouncements(state).map(
        (announcement) =>
          `${announcement.title}（${announcement.timingLabel}）: ${announcement.message}`,
      ),
    },
    sightings,
    submissions,
    reviewLines,
    daytimeViews: describeDaytimeViews(state),
  };
}

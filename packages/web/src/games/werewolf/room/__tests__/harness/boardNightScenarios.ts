import {
  type GameRuleOverrides,
  type GameState,
  GameStatus,
  getWerewolfViewModel,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type PresentedAction,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepPresentation,
  type StepSubmission,
} from '@game-judge/game-engine/platform/steps';
import { waitFor } from '@testing-library/react';

import { TESTIDS } from '@/testids';
import { alertStore } from '@/utils/alert';

import {
  click,
  createWerewolfRoomMockFromState,
  getDispatchOutcome,
  mountWerewolfRoom,
  openNightActionGroup,
  tapSeat,
} from './boardTestUtils';
import { createEngineGame, type EngineGame } from './engineGame';
import { recordAlerts, RoomScreenTestHarness } from './RoomScreenTestHarness';

const MAX_TRANSITIONS = 400;

export interface BoardNightScenario {
  readonly label: string;
  readonly state: GameState;
  readonly viewerSeat: number;
  readonly presentation: StepPresentation;
  readonly action: PresentedAction | null;
  readonly submission: StepSubmission;
}

type BoardStepChoice = Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>;

function chooseSubmission(
  state: GameState,
  presentation: StepPresentation,
  action: PresentedAction,
): StepSubmission {
  const position = { stepId: presentation.stepId, serial: presentation.serial };
  if (action.kind === 'pickSeats') {
    const seats = action.seats
      .filter((option) => option.unavailableReason === null)
      .map((option) => option.seat);
    seats.sort((first, second) => {
      const identities = state.nightState?.roles.identities;
      return (
        Number(identities?.[second]?.currentRole === 'villager') -
        Number(identities?.[first]?.currentRole === 'villager')
      );
    });
    if (seats.length < action.min) {
      throw new Error(`[TEST] ${presentation.stepId}/${action.key} has too few eligible seats`);
    }
    return { ...position, actionKey: action.key, seats: seats.slice(0, action.max) };
  }
  if (action.kind === 'pickCard') {
    const card = action.cards.find((option) => option.unavailableReason === null);
    if (card === undefined) {
      throw new Error(`[TEST] ${presentation.stepId}/${action.key} has no eligible card`);
    }
    return { ...position, actionKey: action.key, cardIndex: card.index };
  }
  return { ...position, actionKey: action.key };
}

function collectActorScenarios(
  state: GameState,
  seat: number,
  presentation: StepPresentation,
  scenarios: Map<string, BoardNightScenario>,
): void {
  if (presentation.pendingResult !== null) {
    const key = `${presentation.stepId}:${STEP_RESULT_ACK_ACTION_KEY}`;
    if (!scenarios.has(key)) {
      scenarios.set(key, {
        label: key,
        state,
        viewerSeat: seat,
        presentation,
        action: null,
        submission: {
          stepId: presentation.stepId,
          serial: presentation.serial,
          actionKey: STEP_RESULT_ACK_ACTION_KEY,
        },
      });
    }
    return;
  }
  for (const action of presentation.actions) {
    if (action.availability.kind !== 'available') continue;
    const key = `${presentation.stepId}:${action.key}`;
    if (scenarios.has(key)) continue;
    scenarios.set(key, {
      label: key,
      state,
      viewerSeat: seat,
      presentation,
      action,
      submission: chooseSubmission(state, presentation, action),
    });
  }
}

function nextActor(
  state: GameState,
  scenarios: Map<string, BoardNightScenario>,
): { readonly seat: number; readonly submission: StepSubmission } | null {
  const night = state.nightState;
  if (night === null) throw new Error('[TEST] Expected an active night state');
  for (const seat of night.roles.seatedSeats) {
    const presentation = getWerewolfViewModel(state, { seat, isHost: seat === 0 }).step;
    if (presentation?.isActor !== true) continue;
    collectActorScenarios(state, seat, presentation, scenarios);
    if (presentation.pendingResult !== null) {
      return {
        seat,
        submission: {
          stepId: presentation.stepId,
          serial: presentation.serial,
          actionKey: STEP_RESULT_ACK_ACTION_KEY,
        },
      };
    }
    const recorded = night.slice.records[presentation.stepId]?.bySeat[seat]?.submissions ?? [];
    if (presentation.stepId === 'wolfKill' && recorded.length > 0) continue;
    const available = presentation.actions.filter(
      (action) => action.availability.kind === 'available',
    );
    const action =
      available.find((candidate) => candidate.key !== STEP_SKIP_ACTION_KEY) ?? available[0];
    if (action !== undefined) {
      return { seat, submission: chooseSubmission(state, presentation, action) };
    }
  }
  return null;
}

function advanceAudioOrDeadline(game: EngineGame): boolean {
  const state = game.getGameState();
  if (state.isAudioPlaying) {
    game.acknowledgePendingAudioOrThrow('complete board narration');
    return true;
  }
  const deadlineMs = state.nightState?.slice.deadlineMs;
  if (deadlineMs === null || deadlineMs === undefined) return false;
  game.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'settle board night step', {
    nowMs: deadlineMs,
  });
  return true;
}

/** Walk a board through real night commands and retain each distinct available UI action. */
export function collectBoardNightScenarios(
  boardName: string | readonly RoleId[],
  roleAssignment?: ReadonlyMap<number, RoleId>,
): BoardNightScenario[] {
  const game = createEngineGame(boardName, roleAssignment);
  const scenarios = new Map<string, BoardNightScenario>();
  for (let transition = 0; transition < MAX_TRANSITIONS; transition += 1) {
    const state = game.getGameState();
    if (state.status !== GameStatus.Ongoing) return [...scenarios.values()];
    if (advanceAudioOrDeadline(game)) continue;
    const actor = nextActor(state, scenarios);
    if (actor === null) {
      throw new Error(`[TEST] ${boardName}: no actor can advance`);
    }
    game.submitStepOrThrow(
      actor.seat,
      actor.submission,
      `${boardName}: ${actor.submission.actionKey}`,
    );
  }
  throw new Error(`[TEST] ${boardName}: night exceeded ${MAX_TRANSITIONS} transitions`);
}

/** Require a collected action rather than silently testing a different step. */
export function requireBoardNightScenario(
  scenarios: readonly BoardNightScenario[],
  stepId: string,
  actionKey: string,
): BoardNightScenario {
  const scenario = scenarios.find(
    (candidate) =>
      candidate.submission.stepId === stepId && candidate.submission.actionKey === actionKey,
  );
  if (scenario === undefined) throw new Error(`[TEST] Missing scenario ${stepId}/${actionKey}`);
  return scenario;
}

/** Advance a preset to a particular real state, using explicit choices for selected steps. */
export function createBoardNightState(
  boardName: string | readonly RoleId[],
  isTarget: (state: GameState) => boolean,
  choices: Readonly<Partial<Record<string, BoardStepChoice>>> = {},
  roleAssignment?: ReadonlyMap<number, RoleId>,
  rules?: GameRuleOverrides,
): GameState {
  const game = createEngineGame(boardName, roleAssignment, rules);
  const scenarios = new Map<string, BoardNightScenario>();
  for (let transition = 0; transition < MAX_TRANSITIONS; transition += 1) {
    const state = game.getGameState();
    if (state.status !== GameStatus.Ongoing) {
      throw new Error(`[TEST] ${boardName}: night ended before reaching the requested state`);
    }
    if (advanceAudioOrDeadline(game)) continue;
    if (isTarget(state)) return state;
    const actor = nextActor(state, scenarios);
    if (actor === null) throw new Error(`[TEST] ${boardName}: no actor can advance`);
    const choice = choices[actor.submission.stepId];
    const submission =
      choice === undefined || actor.submission.actionKey === STEP_RESULT_ACK_ACTION_KEY
        ? actor.submission
        : {
            stepId: actor.submission.stepId,
            serial: actor.submission.serial,
            ...choice,
          };
    game.submitStepOrThrow(actor.seat, submission, `${boardName}: ${submission.actionKey}`);
  }
  throw new Error(`[TEST] ${boardName}: requested state was not reached`);
}

/** The skip or abstention a seat may take instead of acting, when the step offers one. */
function passiveSubmission(state: GameState, seat: number): StepSubmission | null {
  const view = getWerewolfViewModel(state, { seat, isHost: seat === 0 }).step;
  const action = view?.actions.find(
    (candidate) =>
      candidate.availability.kind === 'available' &&
      (candidate.key === STEP_SKIP_ACTION_KEY || candidate.key === 'wolfKillAbstain'),
  );
  return view == null || action === undefined
    ? null
    : { stepId: view.stepId, serial: view.serial, actionKey: action.key };
}

export interface BoardNightOptions {
  /** What a step submits; a step without an entry takes its default action. */
  readonly choices?: Readonly<Partial<Record<string, BoardStepChoice>>>;
  readonly rules?: GameRuleOverrides;
  /** Skip or abstain wherever a step allows it instead of taking the default action. */
  readonly isQuiet?: boolean;
  /** Return as soon as this step is current instead of finishing the night. */
  readonly stopAtStepId?: string;
}

/**
 * Play a night through real commands, with `roles` dealt in seat order.
 * Returns the settled state, or the state parked on `stopAtStepId`.
 */
export function playBoardNight(
  roles: readonly RoleId[],
  options: BoardNightOptions = {},
): GameState {
  return driveBoardNight(createSeatOrderGame(roles, options), roles, options);
}

/** Play a whole night through real commands and hand back the game for the day's commands. */
export function playBoardNightGame(
  roles: readonly RoleId[],
  options: Omit<BoardNightOptions, 'stopAtStepId'> = {},
): EngineGame {
  const game = createSeatOrderGame(roles, options);
  driveBoardNight(game, roles, options);
  return game;
}

function createSeatOrderGame(roles: readonly RoleId[], options: BoardNightOptions): EngineGame {
  return createEngineGame(roles, new Map(roles.map((role, seat) => [seat, role])), options.rules);
}

function driveBoardNight(
  game: EngineGame,
  roles: readonly RoleId[],
  options: BoardNightOptions,
): GameState {
  const { choices = {}, isQuiet = false, stopAtStepId } = options;
  const boardName = roles.join(',');
  const scenarios = new Map<string, BoardNightScenario>();
  for (let transition = 0; transition < MAX_TRANSITIONS; transition += 1) {
    const state = game.getGameState();
    if (state.status !== GameStatus.Ongoing) {
      if (stopAtStepId !== undefined) {
        throw new Error(`[TEST] ${boardName}: the night ended before ${stopAtStepId}`);
      }
      return state;
    }
    if (advanceAudioOrDeadline(game)) continue;
    if (state.nightState?.slice.current?.stepId === stopAtStepId) return state;
    const actor = nextActor(state, scenarios);
    if (actor === null) throw new Error(`[TEST] ${boardName}: no actor can advance`);
    const choice = choices[actor.submission.stepId];
    const isAcknowledgement = actor.submission.actionKey === STEP_RESULT_ACK_ACTION_KEY;
    const submission = isAcknowledgement
      ? actor.submission
      : choice !== undefined
        ? { stepId: actor.submission.stepId, serial: actor.submission.serial, ...choice }
        : ((isQuiet ? passiveSubmission(state, actor.seat) : null) ?? actor.submission);
    game.submitStepOrThrow(actor.seat, submission, `${boardName}: ${submission.actionKey}`);
  }
  throw new Error(`[TEST] ${boardName}: night exceeded ${MAX_TRANSITIONS} transitions`);
}

/** Mount an engine snapshot and pass the host's normal re-entry gate when present. */
export async function mountBoardNightState(state: GameState, seat: number) {
  const mock = createWerewolfRoomMockFromState(state, seat);
  const view = await mountWerewolfRoom(mock);
  const resume = view.queryByRole('button', { name: '继续游戏' });
  if (resume !== null) await click(resume);
  return { mock, view };
}

/** Open a projected action, entering its group when necessary. */
export async function pressStepAction(
  view: Awaited<ReturnType<typeof mountWerewolfRoom>>,
  actionKey: string,
): Promise<void> {
  const testId = TESTIDS.stepInteractionButton(actionKey);
  if (view.queryByTestId(testId) === null) await openNightActionGroup(view);
  await click(await view.findByTestId(testId));
}

async function selectActionInput(
  view: Awaited<ReturnType<typeof mountWerewolfRoom>>,
  scenario: BoardNightScenario,
): Promise<void> {
  const { action, submission } = scenario;
  if (action === null) return;
  await pressStepAction(view, action.key);
  if (action.kind === 'pickSeats') {
    const seats = submission.seats;
    if (seats === undefined) throw new Error('[TEST] Seat action has no chosen seats');
    for (const [index, seat] of seats.entries()) {
      await tapSeat(view, seat);
      expect(view.getByTestId(TESTIDS.seatTilePressable(seat))).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      if (index + 1 < action.min) expect(alertStore.getSnapshot()).toBeNull();
    }
    if (seats.length < action.max) {
      await click(view.getByTestId(TESTIDS.stepInteractionButton(action.key)));
    }
  } else if (action.kind === 'pickCard') {
    if (submission.cardIndex === undefined) throw new Error('[TEST] Card action has no card');
    await click(await view.findByTestId(TESTIDS.stepCardOption(submission.cardIndex)));
  }
}

/** Exercise an action through the production screen and require a real engine commit. */
export async function assertBoardNightScenario(scenario: BoardNightScenario): Promise<void> {
  const harness = new RoomScreenTestHarness();
  const detach = recordAlerts(harness);
  try {
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    await selectActionInput(view, scenario);
    await waitFor(() => expect(harness.getLastEvent()).not.toBeNull());
    if (scenario.action?.kind === 'view') {
      await harness.pressLastPrimary();
      await waitFor(() =>
        expect(harness.getLastEvent()?.title).toBe(
          scenario.action?.kind === 'view' ? (scenario.action.content?.title ?? null) : null,
        ),
      );
    } else if (scenario.action === null) {
      expect(harness.getLastEvent()?.title).toBe(scenario.presentation.pendingResult?.title);
    }
    await harness.pressLastPrimary();
    await waitFor(() =>
      expect(mock.dispatch).toHaveBeenCalledWith(
        {
          type: 'werewolf.step.submit',
          gameSequence: scenario.state.gameSequence,
          submission: scenario.submission,
        },
        expect.anything(),
      ),
    );
    const callIndex = mock.dispatch.mock.calls.findIndex(
      ([command]) => command.type === 'werewolf.step.submit',
    );
    const result = await getDispatchOutcome(mock, callIndex);
    expect(result.kind).toBe('committed');
    if (result.kind === 'committed') expect(result.outcome.kind).toBe('success');
    view.unmount();
  } finally {
    detach();
  }
}

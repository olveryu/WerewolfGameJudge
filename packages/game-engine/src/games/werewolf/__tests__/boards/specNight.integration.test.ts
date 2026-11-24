import {
  deriveDeathNotes,
  type GameState,
  GameStatus,
  getRoleDisplayName,
  getWerewolfNightReview,
  getWerewolfViewModel,
  parseWerewolfState,
  type RoleId,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type PresentedAction,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepPresentation,
  type StepSubmission,
} from '@game-judge/game-engine/platform/steps';

import type { GameContext } from './gameContext';
import { createGame } from './gameFactory';
import { executeStepsUntil } from './stepByStepRunner';

interface Choice {
  readonly actionKey: string;
  readonly seats?: readonly number[];
  readonly cardIndex?: number;
}

type Choices = Readonly<Record<string, Choice>>;

function currentStep(state: GameState): { readonly stepId: string; readonly serial: number } {
  const current = state.nightState?.slice.current;
  if (current == null) throw new Error('[FAIL-FAST] Expected an active spec-driven night step');
  return current;
}

function submit(context: GameContext, seat: number, choice: Choice): void {
  const state = context.getGameState();
  context.dispatchAsSeatOrThrow(
    seat,
    {
      type: 'werewolf.step.submit',
      gameSequence: state.gameSequence,
      submission: { ...currentStep(state), ...choice },
    },
    `submit ${choice.actionKey} at seat ${seat}`,
  );
}

function presentation(state: GameState, seat: number): StepPresentation | null {
  return getWerewolfViewModel(state, { seat, isHost: seat === 0 }).step;
}

function availableAction(view: StepPresentation, choice: Choice | undefined): PresentedAction {
  const available = view.actions.filter((action) => action.availability.kind === 'available');
  const action =
    choice === undefined
      ? (available.find((candidate) => candidate.key === STEP_SKIP_ACTION_KEY) ??
        available.find((candidate) => candidate.key === 'wolfKillAbstain') ??
        available[0])
      : available.find((candidate) => candidate.key === choice.actionKey);
  if (action === undefined) {
    throw new Error(`[FAIL-FAST] No available ${choice?.actionKey ?? 'default'} action`);
  }
  return action;
}

function choiceForAction(action: PresentedAction, choice: Choice | undefined): Choice {
  if (action.kind === 'pickSeats') {
    const seats =
      choice?.seats ??
      action.seats
        .filter((option) => option.unavailableReason === null)
        .slice(0, action.min)
        .map((option) => option.seat);
    if (seats.length < action.min) throw new Error('[FAIL-FAST] Not enough eligible targets');
    return { actionKey: action.key, seats };
  }
  if (action.kind === 'pickCard') {
    const cardIndex =
      choice?.cardIndex ?? action.cards.find((card) => card.unavailableReason === null)?.index;
    if (cardIndex === undefined) throw new Error('[FAIL-FAST] No eligible bottom card');
    return { actionKey: action.key, cardIndex };
  }
  return { actionKey: action.key };
}

function actOneSeat(context: GameContext, choices: Choices): boolean {
  const state = context.getGameState();
  const current = currentStep(state);
  for (const seat of state.nightState?.roles.seatedSeats ?? []) {
    const view = presentation(state, seat);
    if (view?.isActor !== true) continue;
    if (view.pendingResult !== null) {
      submit(context, seat, { actionKey: STEP_RESULT_ACK_ACTION_KEY });
      return true;
    }
    if (
      current.stepId === 'wolfKill' &&
      (state.nightState?.slice.records.wolfKill?.bySeat[seat]?.submissions.length ?? 0) > 0
    ) {
      continue;
    }
    if (view.actions.length === 0) continue;
    const choice = choices[current.stepId];
    submit(context, seat, choiceForAction(availableAction(view, choice), choice));
    return true;
  }
  return false;
}

function driveNight(context: GameContext, choices: Choices): void {
  for (let transition = 0; transition < 300; transition += 1) {
    const state = context.getGameState();
    if (state.isAudioPlaying) {
      context.acknowledgePendingAudioOrThrow('complete night narration');
      continue;
    }
    if (state.status !== GameStatus.Ongoing) return;
    const deadline = state.nightState?.slice.deadlineMs;
    if (deadline != null) {
      context.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'settle night step', {
        nowMs: deadline,
      });
      continue;
    }
    if (!actOneSeat(context, choices)) {
      throw new Error(`[FAIL-FAST] Night step ${currentStep(state).stepId} cannot progress`);
    }
  }
  throw new Error('[FAIL-FAST] Spec-driven night exceeded its transition limit');
}

describe('spec-driven night through production commands', () => {
  it('finishes an empty night plan with a valid persisted state', () => {
    const context = createGame(['villager', 'villager', 'villager']);
    const state = context.getGameState();

    expect(state.status).toBe(GameStatus.Ended);
    expect(state.nightState?.slice.order).toEqual([]);
    expect(state.lastNightDeaths).toEqual([]);
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('keeps wolf votes revisable, clears a withdrawn countdown, and rejects stale submissions', () => {
    const context = createGame('预女猎白');
    const state = context.getGameState();
    const wolves = Object.values(state.players).flatMap((player) =>
      player?.role === 'wolf' ? [player.seat] : [],
    );
    const [first, ...others] = wolves;
    const target = context.findSeatByRole('villager');
    if (first === undefined || others.length === 0 || target < 0) {
      throw new Error('[FAIL-FAST] Wolf-vote fixture is incomplete');
    }
    const step = currentStep(state);
    expect(step.stepId).toBe('wolfKill');
    submit(context, first, { actionKey: 'wolfKill', seats: [target] });
    for (const seat of others) submit(context, seat, { actionKey: 'wolfKill', seats: [target] });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();

    submit(context, first, { actionKey: 'wolfKillWithdraw' });
    expect(context.getGameState().nightState?.slice.deadlineMs).toBeNull();
    expect(presentation(context.getGameState(), first)?.progress).toEqual({
      done: wolves.length - 1,
      total: wolves.length,
    });
    const stale: StepSubmission = {
      ...step,
      serial: step.serial + 1,
      actionKey: 'wolfKillAbstain',
    };
    expect(
      context.dispatchAsSeat(first, {
        type: 'werewolf.step.submit',
        gameSequence: state.gameSequence,
        submission: stale,
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'REASON_STEP_STALE' });
    submit(context, first, { actionKey: 'wolfKill', seats: [target] });
    const deadline = context.getGameState().nightState?.slice.deadlineMs;
    if (deadline == null) throw new Error('[FAIL-FAST] Wolf countdown was not rearmed');
    context.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'settle wolf vote', {
      nowMs: deadline,
    });
    expect(context.getGameState().resolvedWolfKillTarget).toBe(target);
  });

  it('settles disagreeing cupid-board votes as no attack after the countdown', () => {
    const roles: RoleId[] = [
      'cupid',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    expect(executeStepsUntil(context, 'wolfKill', { cupid: { targets: [6, 7] } })).toBe(true);
    submit(context, 1, { actionKey: 'wolfKill', seats: [6] });
    submit(context, 2, { actionKey: 'wolfKill', seats: [7] });
    const deadline = context.getGameState().nightState?.slice.deadlineMs;
    if (deadline == null) throw new Error('[FAIL-FAST] Disagreeing votes did not arm a countdown');
    context.dispatchSystemOrThrow(
      { type: 'werewolf.phase.settleExpired' },
      'settle disagreeing wolf votes',
      { nowMs: deadline },
    );
    expect(context.getGameState().resolvedWolfKillTarget).toBeNull();
    expect(context.getGameState().resolvedWolfKillVerdict).toEqual({ type: 'splitTied' });
  });

  it('keeps the countdown and withdrawal available when the pack cannot attack', () => {
    const roles: RoleId[] = [
      'wolf',
      'wolf',
      'poisoner',
      'seer',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    submit(context, 0, { actionKey: 'wolfKillAbstain' });
    submit(context, 1, { actionKey: 'wolfKillAbstain' });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();

    submit(context, 0, { actionKey: 'wolfKillWithdraw' });
    expect(context.getGameState().nightState?.slice.deadlineMs).toBeNull();
    submit(context, 0, { actionKey: 'wolfKillAbstain' });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();
  });

  it('retains the chosen seat during play and reports the landing after a swap', () => {
    const roles: RoleId[] = [
      'magician',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [6, 7] },
      wolfKill: { actionKey: 'wolfKill', seats: [6] },
      witchAction: { actionKey: 'antidote' },
      seerCheck: { actionKey: 'seerCheck', seats: [6] },
    });
    const state = context.getGameState();
    expect(state.lastNightDeaths).toEqual([]);
    expect(state.nightState?.slice.records.seerCheck?.bySeat[3]?.result).toMatchObject({
      chosenSeat: 6,
      landingSeat: 7,
    });
    const review = getWerewolfNightReview(state);
    expect(review.stepLines).toEqual(
      expect.arrayContaining([
        {
          kind: 'explanation',
          text: '狼队（2、3号）袭击7号（实际为8号）',
        },
        expect.objectContaining({
          kind: 'action',
          roleId: 'witch',
          phrase: '对7号用解药（实际为8号）',
        }),
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未毒杀' }),
      ]),
    );
    expect(
      review.stepLines?.filter((line) => line.kind === 'action' && line.roleId === 'wolf'),
    ).toEqual([]);
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('reports both unused witch potions separately', () => {
    const context = createGame('预女猎白');
    driveNight(context, {});
    expect(getWerewolfNightReview(context.getGameState()).stepLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未用解药' }),
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未毒杀' }),
      ]),
    );
  });

  it('keeps a solo hunter view personal and includes its status in the review', () => {
    const context = createGame(['hunter']);
    const state = context.getGameState();
    const botState: GameState = { ...state, roster: { 0: { seat: 0, kind: 'bot' } } };
    expect(
      getWerewolfViewModel(botState, { seat: null, isHost: true }).canAcknowledgeStepBots,
    ).toBe(false);

    driveNight(context, {});
    expect(getWerewolfNightReview(context.getGameState()).stepLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'hunter', phrase: '可以发动' }),
      ]),
    );
  });

  it('offers bot acknowledgement and seat progress for a declared all-player view', () => {
    const context = createGame(['cupid', 'villager']);
    submit(context, 0, { actionKey: 'cupidChooseLovers', seats: [0, 1] });
    context.acknowledgePendingAudioOrThrow('begin lovers reveal');
    submit(context, 0, { actionKey: 'cupidLoversReveal' });
    const state = context.getGameState();
    const botState: GameState = {
      ...state,
      roster: { ...state.roster, 1: { seat: 1, kind: 'bot' } },
    };
    const view = getWerewolfViewModel(botState, { seat: 0, isHost: true });
    expect(view.canAcknowledgeStepBots).toBe(true);
    expect(view.stepSeatStatuses[0]).toEqual({ kind: 'ready' });

    const current = currentStep(botState);
    const command = {
      type: 'werewolf.step.ackBots',
      gameSequence: botState.gameSequence,
      ...current,
    } as const;
    const host = {
      actor: { kind: 'user', userId: botState.hostUserId },
      controlledSeat: null,
      nowMs: 1_000_100,
      commandId: 'acknowledge-bots',
      randomSeed: 'bot-acknowledgement',
    } as const;
    expect(
      werewolfEngine.decide(botState, { ...command, serial: current.serial + 1 }, host),
    ).toMatchObject({ kind: 'reject', reason: 'REASON_STEP_STALE' });
    const decision = werewolfEngine.decide(botState, command, host);
    if (decision.kind === 'reject')
      throw new Error(`[TEST] bot acknowledgement: ${decision.reason}`);
    const acknowledged = decision.events.reduce(werewolfEngine.evolve, botState);
    expect(
      acknowledged.nightState?.slice.records.cupidLoversReveal?.bySeat[1]?.submissions,
    ).toEqual([expect.objectContaining({ actionKey: 'cupidLoversReveal' })]);
  });

  it('reports the swapped landing together with nightmare and shadow details', () => {
    const roles: RoleId[] = [
      'magician',
      'shadow',
      'avenger',
      'nightmare',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [2, 8] },
      shadowChooseMimic: { actionKey: 'shadowChooseMimic', seats: [8] },
      nightmareBlock: { actionKey: 'nightmareBlock', seats: [8] },
    });
    expect(getWerewolfNightReview(context.getGameState()).stepLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'action',
          roleId: 'shadow',
          phrase: '模仿9号（实际为3号）（绑定）',
        }),
        expect.objectContaining({
          kind: 'action',
          roleId: 'nightmare',
          phrase: '恐惧9号（实际为3号）（复仇者，技能无效）',
        }),
      ]),
    );
  });

  it('attributes each poison death and reports the poisoned hunter status', () => {
    const roles: RoleId[] = [
      'wolf',
      'poisoner',
      'witch',
      'seer',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      poisonerPoison: { actionKey: 'poisonerPoison', seats: [4] },
      witchAction: { actionKey: 'poison', seats: [6] },
    });
    const review = getWerewolfNightReview(context.getGameState());
    expect(deriveDeathNotes(review).get(4)).toEqual({
      kind: 'poisonedBy',
      actorRoleId: 'poisoner',
    });
    expect(deriveDeathNotes(review).get(6)).toEqual({
      kind: 'poisonedBy',
      actorRoleId: 'witch',
    });
    expect(review.stepLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'hunter', phrase: '不能发动' }),
      ]),
    );
  });

  it('reports bottom cards and the card selected through the real night', () => {
    const roles: RoleId[] = [
      'seedWolf',
      'wolf',
      'treasureMaster',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles, undefined, { randomSeed: 'bottom-fixture-1' });
    const actorSeat = context.findSeatByRole('treasureMaster');
    if (actorSeat < 0) throw new Error('[FAIL-FAST] Treasure master was dealt to the bottom');
    driveNight(context, {});
    const state = context.getGameState();
    const record = state.nightState?.slice.records.treasureMasterChoose?.bySeat[actorSeat];
    const cardIndex = record?.submissions.find(
      (submission) => submission.actionKey === 'treasureMasterChoose',
    )?.cardIndex;
    const chosenRole = cardIndex == null ? undefined : state.bottomCards?.[cardIndex];
    if (chosenRole === undefined) throw new Error('[FAIL-FAST] Missing selected bottom card');
    const review = getWerewolfNightReview(state);
    expect(review.actions).toContainEqual({ kind: 'bottomCards', roleIds: state.bottomCards });
    expect(review.stepLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'action',
          seat: actorSeat,
          roleId: 'treasureMaster',
          phrase: `选择${getRoleDisplayName(chosenRole)}为身份`,
        }),
      ]),
    );
  });

  it('round-trips an infected treasure master without losing the dealt-card identity', () => {
    const roles: RoleId[] = [
      'seedWolf',
      'wolf',
      'treasureMaster',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles, undefined, { randomSeed: 'bottom-fixture-1' });
    const target = context.findSeatByRole('treasureMaster');
    expect(target).toBeGreaterThanOrEqual(0);
    driveNight(context, {
      wolfKill: { actionKey: 'wolfKill', seats: [target] },
      seedWolfInfect: { actionKey: 'seedWolfInfect' },
    });
    const state = context.getGameState();
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'converted', targetSeat: target });
    expect(state.nightState?.roles.identities[target]).toMatchObject({
      dealtRole: 'treasureMaster',
      currentRole: 'wolf',
    });
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});

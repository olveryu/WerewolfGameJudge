/**
 * Night-1 integration coverage for the Seed Wolf infection lifecycle.
 *
 * Drives the Seed Wolf Knight preset exclusively through public production commands.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import {
  executeFullNight,
  executeRemainingSteps,
  executeStepsUntil,
  submitActionOrThrow,
} from './stepByStepRunner';

const TEMPLATE_NAME = '种狼骑士';

function createRoleAssignment(): Map<number, RoleId> {
  return new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'villager'],
    [3, 'villager'],
    [4, 'wolf'],
    [5, 'wolf'],
    [6, 'wolf'],
    [7, 'seedWolf'],
    [8, 'seer'],
    [9, 'witch'],
    [10, 'knight'],
    [11, 'guard'],
  ]);
}

describe('Night-1: Seed Wolf infection (12p)', () => {
  let context: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('converts the wolf-killed Seer and removes the Seer action before final confirmation', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());
    const actions = {
      guard: 0,
      wolf: 8,
      witch: { save: null, poison: null },
      seer: 4,
    } as const;

    expect(executeStepsUntil(context, 'seedWolfInfect', actions)).toBe(true);
    context.assertStep('seedWolfInfect');
    submitActionOrThrow(context, 7, { kind: 'confirm' }, 'activate Seed Wolf infection');

    expect(executeStepsUntil(context, 'seedWolfInfectReveal', actions)).toBe(true);
    context.assertStep('seedWolfInfectReveal');

    const revealState = context.getGameState();
    expect(revealState.seedWolfInfectionResult).toEqual({ outcome: 'converted', targetSeat: 8 });
    for (const actorSeat of [4, 5, 6, 7]) {
      expect(revealState.nightState?.facts.wolfVotes).toContainEqual({
        actorSeat,
        chosenSeat: 8,
        landingSeat: 8,
      });
    }
    expect(revealState.players[8]?.role).toBe('wolf');
    expect(revealState.nightState?.slice.records.seerCheck?.bySeat[8]).toBeUndefined();

    for (const player of Object.values(revealState.players)) {
      if (player === null) continue;
      submitActionOrThrow(
        context,
        player.seat,
        { kind: 'confirm' },
        `acknowledge Seed Wolf infection reveal at seat ${player.seat}`,
      );
    }

    const result = executeRemainingSteps(context);
    expect(result.completed).toBe(true);
    expect(result.deaths).not.toContain(8);
  });

  it('fails infection when Guard prevents the wolf kill and releases the Seer reveal', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(context, {
      guard: 8,
      wolf: 8,
      seedWolf: { confirmed: true },
      witch: { save: null, poison: null },
      seer: 4,
    });

    const state = context.getGameState();
    expect(result.completed).toBe(true);
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'failed', targetSeat: 8 });
    expect(state.nightState?.facts.selections).toContainEqual(
      expect.objectContaining({ roleId: 'guard', landingSeat: 8 }),
    );
    expect(state.players[8]?.role).toBe('seer');
    expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
      chosenSeat: 4,
      faction: 'wolf',
    });
    expect(result.deaths).not.toContain(8);
  });

  it('shows an infected villager as an ordinary wolf to the Seer', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(context, {
      guard: 1,
      wolf: 0,
      seedWolf: { confirmed: true },
      witch: { save: null, poison: null },
      seer: 0,
    });

    const state = context.getGameState();
    expect(result.completed).toBe(true);
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'converted', targetSeat: 0 });
    expect(state.players[0]?.role).toBe('wolf');
    expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
      chosenSeat: 0,
      faction: 'wolf',
    });
  });

  it('shows the original faction when Guard makes infection fail', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(context, {
      guard: 0,
      wolf: 0,
      seedWolf: { confirmed: true },
      witch: { save: null, poison: null },
      seer: 0,
    });

    const state = context.getGameState();
    expect(result.completed).toBe(true);
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'failed', targetSeat: 0 });
    expect(state.players[0]?.role).toBe('villager');
    expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toMatchObject({
      chosenSeat: 0,
      faction: 'good',
    });
  });

  it('removes wolf-kill damage but preserves poison on a converted target', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(context, {
      guard: 0,
      wolf: 8,
      seedWolf: { confirmed: true },
      witch: { save: null, poison: 8 },
      seer: 4,
    });

    const state = context.getGameState();
    expect(result.completed).toBe(true);
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'converted', targetSeat: 8 });
    expect(state.nightState?.facts.deathEffects).toContainEqual(
      expect.objectContaining({ kind: 'attack', cause: 'poison', target: 8 }),
    );
    expect(state.players[8]?.role).toBe('wolf');
    expect(result.deaths).toContain(8);
    expect(state.deathReasons?.[8]).toBe('poison');
  });

  it('keeps the wolf kill when Seed Wolf chooses not to use the skill', () => {
    context = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(context, {
      guard: 1,
      wolf: 0,
      seedWolf: { confirmed: false },
      witch: { save: null, poison: null },
      seer: 4,
    });

    const state = context.getGameState();
    expect(result.completed).toBe(true);
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'notUsed' });
    expect(state.nightState?.facts.wolfInfections ?? []).toEqual([]);
    expect(state.players[0]?.role).toBe('villager');
    expect(result.deaths).toContain(0);
    expect(state.deathReasons?.[0]).toBe('wolfKill');
  });
});

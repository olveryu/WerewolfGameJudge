/**
 * Night-1 Integration Test: Gargoyle Check
 *
 * Theme: Gargoyle check result (returns specific role) and changes after swap.
 *
 * Template: Awakened Gargoyle + Graveyard Keeper
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: gargoyle
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: graveyardKeeper
 *
 * Core rules:
 * - gargoyle check returns specific role (not faction)
 * - Check result based on post-swap identity
 * - Result written to GameState.gargoyleReveal
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE } from '@game-judge/game-engine/platform/steps';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import {
  dispatchStep,
  executeFullNight,
  executeRemainingSteps,
  executeStepsUntil,
} from './stepByStepRunner';

const TEMPLATE_NAME = '石像鬼守墓人';

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'gargoyle');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'graveyardKeeper');
  return map;
}

describe('Night-1: Gargoyle Check (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Gargoyle 查验返回具体角色', () => {
    it('gargoyle 查验 villager(0)，返回 villager', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we reached the gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        gargoyle: 0, // Check villager
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.gargoyleCheck?.bySeat[7]?.result).toMatchObject({
        kind: 'identityCheck',
        chosenSeat: 0,
        landingSeat: 0,
        roleId: 'villager',
      });
    });

    it('gargoyle 查验 wolf(4)，返回 wolf', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 4, // Check wolf
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 5,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.gargoyleCheck?.bySeat[7]?.result).toMatchObject({
        kind: 'identityCheck',
        chosenSeat: 4,
        landingSeat: 4,
        roleId: 'wolf',
      });
    });

    it('gargoyle 查验 seer(8)，返回 seer', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 8, // Check seer
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.gargoyleCheck?.bySeat[7]?.result).toMatchObject({
        kind: 'identityCheck',
        chosenSeat: 8,
        landingSeat: 8,
        roleId: 'seer',
      });
    });

    it('gargoyle 查验 hunter(10)，返回 hunter', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 10, // Check hunter
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.gargoyleCheck?.bySeat[7]?.result).toMatchObject({
        kind: 'identityCheck',
        chosenSeat: 10,
        landingSeat: 10,
        roleId: 'hunter',
      });
    });
  });

  describe('Gargoyle 空选', () => {
    it('gargoyle 不查验时，gargoyleReveal 不写入', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we reached the gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        gargoyle: null, // No check
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.gargoyleCheck?.bySeat[7]?.result).toBeNull();
    });
  });

  describe('Gargoyle 查验狼阵营角色', () => {
    it('gargoyle 查验自己应被拒绝 (notSelf constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we reached the gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 7, isHost: false }).step;
      const action = step?.actions.find((entry) => entry.kind === 'pickSeats');
      expect(action?.kind === 'pickSeats' && action.seats.find((seat) => seat.seat === 7)).toEqual({
        seat: 7,
        unavailableReason: '不能选择自己',
      });
      expect(dispatchStep(ctx, 7, { actionKey: 'gargoyleCheck', seats: [7] })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
      });
    });
  });
});

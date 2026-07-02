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
 * - Result written to WerewolfState.gargoyleReveal
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

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

      // Core assertion: gargoyleReveal returns specific role
      const state = ctx.getGameState();
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(0);
      expect(state.gargoyleReveal!.result).toBe('villager');
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
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(4);
      expect(state.gargoyleReveal!.result).toBe('wolf');
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
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(8);
      expect(state.gargoyleReveal!.result).toBe('seer');
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
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(10);
      expect(state.gargoyleReveal!.result).toBe('hunter');
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

      // gargoyleReveal should be undefined
      const state = ctx.getGameState();
      expect(state.gargoyleReveal).toBeUndefined();
    });
  });

  describe('Gargoyle 查验狼阵营角色', () => {
    it('gargoyle 查验自己应被拒绝 (notSelf constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we reached the gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // Gargoyle checking self should be rejected
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'gargoyle',
        target: 7,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('自己');
    });
  });
});

/**
 * Night-1 Integration Test: Psychic Reveal
 *
 * Topic: Psychic check result writes and changes after swap.
 *
 * Template: Wolf Robot Psychic
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: psychic
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules:
 * - Psychic check result writes to WerewolfState.psychicReveal
 * - Result based on target's faction (good/wolf)
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '机械狼人通灵师';

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
  map.set(7, 'wolfRobot');
  map.set(8, 'psychic');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Psychic Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Psychic 查验结果写入 psychicReveal', () => {
    /**
     * Psychic resolver returns identityResult (exact roleId),
     * not faction (good/wolf).
     *
     * Similar to Gargoyle (returns exact role), unlike Seer (returns faction).
     */
    it('psychic 查验 villager(0)，应返回 roleId "villager"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we did reach psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null, // wolfRobot learn (if any)
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 0, // check villager
      });

      expect(result.completed).toBe(true);

      // Core assertion: psychicReveal written to WerewolfState
      const state = ctx.getGameState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(0);
      expect(state.psychicReveal!.result).toBe('villager');
    });

    it('psychic 查验 wolf(4)，应返回 roleId "wolf"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 4, // check wolf
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(4);
      expect(state.psychicReveal!.result).toBe('wolf');
    });

    it('psychic 查验 wolfRobot(7，狼阵营)，应返回 roleId "wolfRobot"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 7, // check wolfRobot
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(7);
      // wolfRobot is wolf faction; returns exact roleId
      expect(state.psychicReveal!.result).toBe('wolfRobot');
    });
  });

  describe('Psychic 空选', () => {
    it('psychic 不查验时，psychicReveal 不写入或为空', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we did reach psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: null, // no check
      });

      expect(result.completed).toBe(true);

      // psychicReveal should be undefined or contain no result
      const state = ctx.getGameState();
      expect(state.psychicReveal?.result).toBeUndefined();
    });
  });

  describe('Psychic 查验好人阵营角色', () => {
    it('psychic 查验 guard(11，好人阵营)，应返回 roleId "guard"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: confirm we did reach psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null,
        guard: 0, // guard protects
        wolf: 1,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 11, // check guard
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(11);
      // psychic returns exact roleId
      expect(state.psychicReveal!.result).toBe('guard');
    });

    it('psychic 查验 witch(9，好人阵营)，应返回 roleId "witch"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 9, // check witch
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(9);
      expect(state.psychicReveal!.result).toBe('witch');
    });
  });
});

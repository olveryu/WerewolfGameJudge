/**
 * Night-1 Integration Test: EclipseWolfQueen Shelter Redirect
 *
 * Topic: Eclipse Wolf Queen shelter mechanic - god-role skill target redirect.
 *
 * Template: 永序之轮
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: eclipseWolfQueen
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: sequencePrince
 *
 * Core rules:
 * - Eclipse Wolf Queen selects a player to shelter (shelteredSeat)
 * - Good-faction god role targets the sheltered seat -> effect redirected to the caster itself
 * - Wolf-faction targets the sheltered seat -> unaffected
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '永序之轮';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'eclipseWolfQueen');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'sequencePrince');
  return map;
}

describe('Night-1: EclipseWolfQueen Shelter Redirect (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('放逐对预言家查验的重定向', () => {
    it('预言家查验被放逐者 → 查验结果为预言家自身阵营（好人）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen shelters seat 4 (wolf)
      // seer checks seat 4 -> redirected to checking self (seat 8) -> result: good faction
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 4,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // Check sheltered wolf -> redirected to self
      });

      expect(result.completed).toBe(true);

      // Core assertion: the seer action's targetSeat is redirected to the seer's own seat
      const state = ctx.getGameState();
      const shelterAction = state.actions?.find((a) => a.schemaId === 'eclipseWolfQueenShelter');
      expect(shelterAction).toBeDefined();
      expect(shelterAction!.targetSeat).toBe(4);

      const seerAction = state.actions?.find((a) => a.schemaId === 'seerCheck');
      expect(seerAction).toBeDefined();
      expect(seerAction!.targetSeat).toBe(8); // Redirected to seer self
    });

    it('预言家查验未被放逐者 → 正常查验', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen shelters seat 0 (villager)
      // seer checks seat 4 (wolf) -> unaffected
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4, // Check non-sheltered wolf
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      const seerAction = state.actions?.find((a) => a.schemaId === 'seerCheck');
      expect(seerAction).toBeDefined();
      expect(seerAction!.targetSeat).toBe(4); // Not redirected
    });
  });

  describe('放逐对守卫的重定向', () => {
    it('守卫守护被放逐者 → guardedSeat 为守卫自身', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen shelters seat 0
      // guard protects seat 0 -> redirected to protecting self (seat 10)
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: 0, // Protect sheltered seat -> redirected
        wolf: 0, // Attack seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // The guard action's targetSeat is redirected to the guard itself
      const state = ctx.getGameState();
      const guardAction = state.actions?.find((a) => a.schemaId === 'guardProtect');
      expect(guardAction).toBeDefined();
      expect(guardAction!.targetSeat).toBe(10); // Redirected to guard self

      // seat 0 is attacked by wolves with no effective protection -> dies
      expect(result.deaths).toContain(0);
    });
  });

  describe('放逐对女巫毒药的重定向', () => {
    it('女巫毒被放逐者 → poisonedSeat 为女巫自身', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen shelters seat 0
      // witch poisons seat 0 -> redirected to poisoning self (seat 9)
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 1, // Attack seat 1
        witch: { save: null, poison: 0 }, // Poison sheltered seat -> redirected
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Witch poisons herself + wolves attack seat 1
      expect(result.deaths).toContain(9); // Witch herself
      expect(result.deaths).toContain(1); // Attacked seat
      expect(result.deaths).not.toContain(0); // Sheltered seat is safe
    });
  });

  describe('蚀时狼妃不蚀时', () => {
    it('eclipseWolfQueen 空选，神职技能正常执行', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        eclipseWolfQueen: null, // No shelter
        guard: 0,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // guard protects seat 0 normally
      const state = ctx.getGameState();
      const guardAction = state.actions?.find((a) => a.schemaId === 'guardProtect');
      expect(guardAction!.targetSeat).toBe(0); // Not redirected

      // seat 0 is protected -> survives
      expect(result.deaths).not.toContain(0);
    });
  });

  describe('狼人阵营不受放逐影响', () => {
    it('狼人袭击被放逐者 → 正常袭击不重定向', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen shelters seat 0
      // wolf attacks seat 0 -> wolves are Wolf team, no redirect
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 0, // Attack sheltered seat
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);
      // seat 0 dies normally (wolves are not affected by shelter redirect)
      expect(result.deaths).toContain(0);
    });
  });
});

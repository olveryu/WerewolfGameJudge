/**
 * Night-1 Integration Test: Spirit Knight - Reflection
 *
 * Board: Spirit Knight
 * Theme: Spirit Knight reflection mechanic
 *
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: spiritKnight
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules (from DeathCalculator.processSpiritKnightReflection):
 * - Spirit Knight immune to wolf kill (wolf kill has no effect)
 * - Seer inspects Spirit Knight -> Seer dies (reflection)
 * - Witch poisons Spirit Knight -> Witch dies, Spirit Knight immune (reflection + immunity)
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '恶灵骑士';

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
  map.set(7, 'spiritKnight');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: 恶灵骑士 - Spirit Knight Reflection (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Seer 查验 spiritKnight → Seer 反伤死亡', () => {
    it('seer 查验 spiritKnight(7)，seer 反伤死亡，spiritKnight 不死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // kill villager(0)
        witch: { save: null, poison: null },
        seer: 7, // inspect spiritKnight
      });

      expect(result.completed).toBe(true);

      // Core assertion 1: seerReveal written (theme field)
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // Core assertion 2: seer(8) dies by reflection
      expect(result.deaths).toContain(8);

      // Core assertion 3: spiritKnight(7) does not die
      expect(result.deaths).not.toContain(7);

      // Extra assertion: villager(0) killed by wolf also dies
      expect(result.deaths).toContain(0);

      // Full death list
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 8]);
    });

    it('seer 不查验 spiritKnight 时，seer 不反伤死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // inspect wolf, not spiritKnight
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal written, but target is not spiritKnight
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);

      // seer(8) does not die by reflection
      expect(result.deaths).not.toContain(8);

      // Only the killed villager(0) dies
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Witch 毒 spiritKnight → Witch 反伤死亡', () => {
    it('witch 毒 spiritKnight(7)，witch 反伤死亡，spiritKnight 不死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // skip kill
        witch: { save: null, poison: 7 }, // poison spiritKnight
        seer: 4, // inspect wolf, no reflection
      });

      expect(result.completed).toBe(true);

      // Core assertion 1: witch action records poisonedSeat (theme field)
      const state = ctx.getGameState();
      expect(state.currentNightResults?.poisonedSeat).toBe(7);

      // Core assertion 2: witch(9) dies by reflection
      expect(result.deaths).toContain(9);

      // Core assertion 3: spiritKnight(7) immune to poison, does not die
      expect(result.deaths).not.toContain(7);

      // Full death list: only witch dies
      expect(result.deaths).toEqual([9]);
    });

    it('witch 毒非 spiritKnight 目标时，witch 不反伤死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // skip kill
        witch: { save: null, poison: 0 }, // poison villager(0)
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: poisonedSeat written
      const state = ctx.getGameState();
      expect(state.currentNightResults?.poisonedSeat).toBe(0);

      // witch(9) does not die by reflection
      expect(result.deaths).not.toContain(9);

      // Only the poisoned villager(0) dies
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Wolf 袭击 spiritKnight → 禁选（免疫实现）', () => {
    /**
     * spiritKnight wolf-kill immunity is implemented via "forbidden selection" (immuneToWolfKill flag).
     * Wolves cannot select spiritKnight at vote time, rather than immunity at settlement.
     * This test verifies the normal flow when wolves choose another target.
     */
    it('wolf 袭击 villager(0)，流程正常执行', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // kill villager (spiritKnight is forbidden target)
        witch: { save: null, poison: null },
        seer: 1, // inspect villager
      });

      expect(result.completed).toBe(true);

      // villager(0) dies
      expect(result.deaths).toContain(0);

      // spiritKnight(7) survives
      expect(result.deaths).not.toContain(7);
    });
  });
});

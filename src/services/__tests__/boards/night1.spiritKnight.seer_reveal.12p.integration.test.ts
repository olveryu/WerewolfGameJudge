/**
 * Night-1 Integration Test: Spirit Knight - Seer Reveal
 *
 * Board: Spirit Knight
 * Topic: Seer check result written to GameState.seerReveal
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
 * Architecture: intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

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

describe('Night-1: 恶灵骑士 - Seer Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Seer 查验结果写入 seerReveal', () => {
    it('seer 查验 villager(0)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // 查验 villager
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal written to GameState
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['good', '好人']).toContain(state.seerReveal!.result);

      expect(result.deaths).toEqual([1]);
    });

    it('seer 查验 spiritKnight(7，狼阵营)，seerReveal.result 为 "狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 7, // 查验 spiritKnight
      });

      expect(result.completed).toBe(true);

      // Core assertion: spiritKnight is wolf faction
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });

  describe('Seer 空选', () => {
    it('seer 不查验时，seerReveal 不包含结果', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: null, // 不查验
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal has no result
      expect(ctx.getGameState().seerReveal?.result).toBeUndefined();
    });
  });

  describe('Guard + Seer 协作', () => {
    it('guard 守护 seer，seer 查验 wolf，seerReveal 和 guardedSeat 都写入', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: 8, // 守护 seer
        wolf: 8, // 袭击 seer
        witch: { save: null, poison: null },
        seer: 4, // 查验 wolf
      });

      expect(result.completed).toBe(true);

      // Core assertion 1: seerReveal written
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // Core assertion 2: guardedSeat written
      expect(state.currentNightResults?.guardedSeat).toBe(8);

      // Guard blocked the wolf attack on seer, no one dies
      expect(result.deaths).toEqual([]);
    });
  });
});

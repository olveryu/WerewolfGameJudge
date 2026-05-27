/**
 * Night-1 Integration Test: SeerWitchHunterIdiot - Seer Reveal
 *
 * Board: SeerWitchHunterIdiot
 * Theme: Seer check result written to GameState.seerReveal
 *
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-7: wolf
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: idiot
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '预女猎白';

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
  map.set(7, 'wolf');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'idiot');
  return map;
}

describe('Night-1: 预女猎白 - Seer Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Seer 查验结果写入 seerReveal', () => {
    it('seer 查验 villager(0)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // Check villager
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal written to GameState
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['good', '好人']).toContain(state.seerReveal!.result);

      expect(result.deaths).toEqual([1]);
    });

    it('seer 查验 wolf(4)，seerReveal.result 为 "狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // Check wolf
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal written
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });

  describe('Seer 空选', () => {
    it('seer 不查验时，seerReveal 不包含结果', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: null, // 不查验
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal has no result
      expect(ctx.getGameState().seerReveal?.result).toBeUndefined();
    });
  });

  describe('Seer 查验特殊角色', () => {
    it('seer 查验 witch(9，好人阵营)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 9, // 查验 witch
      });

      expect(result.completed).toBe(true);

      // Core assertion: witch is good faction
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(9);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });

    it('seer 查验 idiot(11，好人阵营)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 11, // 查验 idiot
      });

      expect(result.completed).toBe(true);

      // Core assertion: idiot is good faction
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(11);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });
  });
});

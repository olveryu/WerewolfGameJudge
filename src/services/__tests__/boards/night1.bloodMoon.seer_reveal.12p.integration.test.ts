/**
 * Night-1 Integration Test: Blood Moon Hunter - Seer Reveal
 *
 * Board: Blood Moon Hunter
 * Theme: Seer check result writes to GameState.seerReveal
 *
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: bloodMoon
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: idiot
 *   seat 11: witcher
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '血月猎魔';

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
  map.set(7, 'bloodMoon');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'idiot');
  map.set(11, 'witcher');
  return map;
}

describe('Night-1: 血月猎魔 - Seer Reveal (12p)', () => {
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
        seer: 0, // check villager
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal written to GameState
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['good', '好人']).toContain(state.seerReveal!.result);

      expect(result.deaths).toEqual([1]);
    });

    it('seer 查验 bloodMoon(7，狼阵营)，seerReveal.result 为 "狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 7, // check bloodMoon
      });

      expect(result.completed).toBe(true);

      // Core assertion: bloodMoon is in the wolf faction
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
        wolf: 0,
        witch: { save: null, poison: null },
        seer: null, // no check
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal has no result
      expect(ctx.getGameState().seerReveal?.result).toBeUndefined();
    });
  });

  describe('Seer 查验 witcher（特殊好人）', () => {
    it('seer 查验 witcher(11，好人阵营)，seerReveal.result 为 "好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 11, // 查验 witcher
      });

      expect(result.completed).toBe(true);

      // core assertion: witcher is good faction
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(11);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });
  });
});

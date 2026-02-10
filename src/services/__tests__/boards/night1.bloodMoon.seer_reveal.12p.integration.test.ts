/**
 * Night-1 Integration Test: 血月猎魔12人 - Seer Reveal
 *
 * 板子：血月猎魔12人
 * 主题：预言家查验结果写入 BroadcastGameState.seerReveal
 *
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: bloodMoon
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: idiot
 *   seat 11: witcher
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '血月猎魔12人';

/**
 * 固定 seat-role assignment
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

describe('Night-1: 血月猎魔12人 - Seer Reveal (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Seer 查验结果写入 seerReveal', () => {
    it('seer 查验 villager(0)，seerReveal.result 为 "好人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // 查验 villager
      });

      expect(result.completed).toBe(true);

      // 核心断言：seerReveal 写入 BroadcastGameState
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['good', '好人']).toContain(state.seerReveal!.result);

      expect(result.deaths).toEqual([1]);
    });

    it('seer 查验 bloodMoon(7，狼阵营)，seerReveal.result 为 "狼人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 7, // 查验 bloodMoon
      });

      expect(result.completed).toBe(true);

      // 核心断言：bloodMoon 是狼阵营
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });

  describe('Seer 空选', () => {
    it('seer 不查验时，seerReveal 不包含结果', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: null, // 不查验
      });

      expect(result.completed).toBe(true);

      // 核心断言：seerReveal 无结果
      expect(ctx.getBroadcastState().seerReveal?.result).toBeUndefined();
    });
  });

  describe('Seer 查验 witcher（特殊好人）', () => {
    it('seer 查验 witcher(11，好人阵营)，seerReveal.result 为 "好人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 11, // 查验 witcher
      });

      expect(result.completed).toBe(true);

      // 核心断言：witcher 是好人阵营
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(11);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });
  });
});

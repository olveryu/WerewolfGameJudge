/**
 * Night-1 Integration Test: 恶灵骑士12人 - Spirit Knight Reflection
 *
 * 板子：恶灵骑士12人
 * 主题：恶灵骑士反伤机制
 *
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: spiritKnight
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则（来自 DeathCalculator.processSpiritKnightReflection）：
 * - Spirit Knight 免疫狼刀（wolf kill has no effect）
 * - Seer 查验 Spirit Knight → Seer 死亡（反伤）
 * - Witch 毒 Spirit Knight → Witch 死亡，Spirit Knight 免疫（反伤 + 免疫）
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '恶灵骑士12人';

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
  map.set(7, 'spiritKnight');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: 恶灵骑士12人 - Spirit Knight Reflection (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Seer 查验 spiritKnight → Seer 反伤死亡', () => {
    it('seer 查验 spiritKnight(7)，seer 反伤死亡，spiritKnight 不死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // 狼刀 villager(0)
        witch: { save: null, poison: null },
        seer: 7, // 查验 spiritKnight
      });

      expect(result.completed).toBe(true);

      // 核心断言 1：seerReveal 写入（主题字段）
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // 核心断言 2：seer(8) 反伤死亡
      expect(result.deaths).toContain(8);

      // 核心断言 3：spiritKnight(7) 不死
      expect(result.deaths).not.toContain(7);

      // 额外断言：villager(0) 被狼刀也死了
      expect(result.deaths).toContain(0);

      // 完整死亡列表
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 8]);
    });

    it('seer 不查验 spiritKnight 时，seer 不反伤死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // 查验 wolf，不是 spiritKnight
      });

      expect(result.completed).toBe(true);

      // 核心断言：seerReveal 写入，但目标不是 spiritKnight
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);

      // seer(8) 不反伤死亡
      expect(result.deaths).not.toContain(8);

      // 只有被狼刀的 villager(0) 死亡
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Witch 毒 spiritKnight → Witch 反伤死亡', () => {
    it('witch 毒 spiritKnight(7)，witch 反伤死亡，spiritKnight 不死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // 空刀
        witch: { save: null, poison: 7 }, // 毒 spiritKnight
        seer: 4, // 查验 wolf，不触发反伤
      });

      expect(result.completed).toBe(true);

      // 核心断言 1：witch 的 action 记录 poisonedSeat（主题字段）
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.poisonedSeat).toBe(7);

      // 核心断言 2：witch(9) 反伤死亡
      expect(result.deaths).toContain(9);

      // 核心断言 3：spiritKnight(7) 免疫毒药，不死
      expect(result.deaths).not.toContain(7);

      // 完整死亡列表：只有 witch 死
      expect(result.deaths).toEqual([9]);
    });

    it('witch 毒非 spiritKnight 目标时，witch 不反伤死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // 空刀
        witch: { save: null, poison: 0 }, // 毒 villager(0)
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：poisonedSeat 写入
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.poisonedSeat).toBe(0);

      // witch(9) 不反伤死亡
      expect(result.deaths).not.toContain(9);

      // 只有被毒的 villager(0) 死亡
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Wolf 刀 spiritKnight → 禁选（免疫实现）', () => {
    /**
     * spiritKnight 的狼刀免疫是通过"禁选"实现的（immuneToWolfKill flag）。
     * 狼人在投票时就无法选择 spiritKnight，而不是事后结算时免疫。
     * 此测试验证狼人选择其他目标时的正常流程。
     */
    it('wolf 刀 villager(0)，流程正常执行', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // 狼刀 villager（spiritKnight 是禁选目标）
        witch: { save: null, poison: null },
        seer: 1, // 查验 villager
      });

      expect(result.completed).toBe(true);

      // villager(0) 死亡
      expect(result.deaths).toContain(0);

      // spiritKnight(7) 存活
      expect(result.deaths).not.toContain(7);
    });
  });
});

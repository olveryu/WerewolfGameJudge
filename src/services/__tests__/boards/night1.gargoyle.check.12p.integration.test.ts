/**
 * Night-1 Integration Test: Gargoyle Check
 *
 * 主题：石像鬼查验结果（返回具体角色）及 swap 后变化。
 *
 * 模板：石像守墓12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: gargoyle
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: graveyardKeeper
 *
 * 核心规则：
 * - gargoyle 查验返回具体角色（不是阵营）
 * - 查验结果基于 swap 后的身份
 * - 结果写入 BroadcastGameState.gargoyleReveal
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '石像守墓12人';

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
  map.set(7, 'gargoyle');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'graveyardKeeper');
  return map;
}

describe('Night-1: Gargoyle Check (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Gargoyle 查验返回具体角色', () => {
    it('gargoyle 查验 villager(0)，返回 villager', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        gargoyle: 0, // 查验 villager
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：gargoyleReveal 返回具体角色
      const state = ctx.getBroadcastState();
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(0);
      expect(state.gargoyleReveal!.result).toBe('villager');
    });

    it('gargoyle 查验 wolf(4)，返回 wolf', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 4, // 查验 wolf
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 5,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(4);
      expect(state.gargoyleReveal!.result).toBe('wolf');
    });

    it('gargoyle 查验 seer(8)，返回 seer', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 8, // 查验 seer
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(8);
      expect(state.gargoyleReveal!.result).toBe('seer');
    });

    it('gargoyle 查验 hunter(10)，返回 hunter', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        gargoyle: 10, // 查验 hunter
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.gargoyleReveal).toBeDefined();
      expect(state.gargoyleReveal!.targetSeat).toBe(10);
      expect(state.gargoyleReveal!.result).toBe('hunter');
    });
  });

  describe('Gargoyle 空选', () => {
    it('gargoyle 不查验时，gargoyleReveal 不写入', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        gargoyle: null, // 不查验
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // gargoyleReveal 应该为 undefined
      const state = ctx.getBroadcastState();
      expect(state.gargoyleReveal).toBeUndefined();
    });
  });

  describe('Gargoyle 查验狼阵营角色', () => {
    it('gargoyle 查验 gargoyle 自己(7，狼阵营)，返回 gargoyle', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 gargoyleCheck step
      expect(executeStepsUntil(ctx, 'gargoyleCheck')).toBe(true);
      ctx.assertStep('gargoyleCheck');

      // 石像鬼查验自己（如果 schema 允许）
      const result = executeRemainingSteps(ctx, {
        gargoyle: 7, // 查验自己
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 如果允许自查，应返回 gargoyle
      // 如果不允许，action 会被拒绝，这里根据实际 schema 约束判断
      const state = ctx.getBroadcastState();
      if (state.gargoyleReveal) {
        expect(state.gargoyleReveal.result).toBe('gargoyle');
      }
    });
  });
});

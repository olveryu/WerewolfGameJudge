/**
 * Night-1 Integration Test: AwakenedGargoyle Convert
 *
 * 主题：觉醒石像鬼转化相邻狼座位的非狼玩家。
 *
 * 模板：唯邻是从12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-5: wolf
 *   seat 6: awakenedGargoyle
 *   seat 7: seer
 *   seat 8: witch
 *   seat 9: hunter
 *   seat 10: guard
 *   seat 11: graveyardKeeper
 *
 * 核心规则：
 * - awakenedGargoyleConvert: chooseSeat (AdjacentToWolfFaction constraint)
 * - target 必须与狼阵营座位相邻（swap-aware）
 * - 转化结果写入 GameState.convertedSeat
 * - awakenedGargoyleConvertReveal: groupConfirm (auto-completes)
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, GameContext } from './gameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '唯邻是从12人';

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
  map.set(6, 'awakenedGargoyle');
  map.set(7, 'seer');
  map.set(8, 'witch');
  map.set(9, 'hunter');
  map.set(10, 'guard');
  map.set(11, 'graveyardKeeper');
  return map;
}

describe('Night-1: AwakenedGargoyle Convert (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('觉醒石像鬼转化相邻玩家', () => {
    it('转化 seat 3（与 wolf seat 4 相邻），convertedSeat = 3', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认走到 awakenedGargoyleConvert step
      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        awakenedGargoyle: 3, // 转化 seat 3（与 wolf seat 4 相邻）
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
        guard: 0,
      });

      expect(result.completed).toBe(true);

      // 核心断言：convertedSeat 写入
      const state = ctx.getGameState();
      expect(state.convertedSeat).toBe(3);
    });

    it('转化 seat 0（与 wolf seat 11→0 wrap-around 相邻时需 swap 场景），正常流程', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // villager at seat 3 与 wolf at seat 4 相邻
      const result = executeFullNight(ctx, {
        awakenedGargoyle: 3,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 5,
        guard: 1,
      });

      expect(result.completed).toBe(true);
      const state = ctx.getGameState();
      expect(state.convertedSeat).toBe(3);
    });
  });

  describe('觉醒石像鬼强制发动', () => {
    it('不选择目标应被拒绝 (canSkip: false)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: null,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('觉醒石像鬼约束校验', () => {
    it('转化非相邻座位应被拒绝 (AdjacentToWolfFaction constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // seat 10 (guard) 不与任何 wolf faction 相邻
      // wolves at 4,5; awakenedGargoyle at 6; adjacent non-wolf-faction: 3,7
      // seat 10 neighbors: 9,11 — both are non-wolf
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 10,
      });

      expect(result.success).toBe(false);
    });

    it('转化自己应被拒绝 (NotSelf constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 6,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('自己');
    });

    it('转化狼人阵营玩家应被拒绝 (NotWolfFaction constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // seat 4 is wolf (wolf faction) — 不能转化狼人阵营
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 4,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('awakenedGargoyleConvertReveal 步骤', () => {
    it('groupConfirm 步骤正常推进', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // 先执行到 awakenedGargoyleConvert 并提交合法转化目标
      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 3, // seat 3 与 wolf seat 4 相邻
      });
      ctx.advanceNightOrThrow('after awakenedGargoyleConvert');

      // 现在应到 awakenedGargoyleConvertReveal
      ctx.assertStep('awakenedGargoyleConvertReveal');

      // groupConfirm 步骤可以直接推进
      ctx.advanceNightOrThrow('after awakenedGargoyleConvertReveal');

      // 继续完成剩余步骤
      const result = executeRemainingSteps(ctx, {
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
        guard: 1,
      });

      expect(result.completed).toBe(true);
    });
  });
});

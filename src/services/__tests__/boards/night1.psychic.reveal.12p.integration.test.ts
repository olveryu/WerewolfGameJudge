/**
 * Night-1 Integration Test: Psychic Reveal
 *
 * 主题：通灵师查验结果的写入与 swap 后变化。
 *
 * 模板：机械狼通灵师12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: psychic
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则：
 * - psychic 查验结果写入 BroadcastGameState.psychicReveal
 * - 查验结果基于目标的阵营（好人/狼人）
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight, executeRemainingSteps,executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '机械狼通灵师12人';

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
  map.set(7, 'wolfRobot');
  map.set(8, 'psychic');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Psychic Reveal (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Psychic 查验结果写入 psychicReveal', () => {
    /**
     * Psychic resolver 返回 identityResult (exact roleId)，
     * 而不是阵营（good/wolf）。
     *
     * 这与 Gargoyle 类似（返回精确角色），而不是 Seer（返回阵营）。
     */
    it('psychic 查验 villager(0)，应返回 roleId "villager"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null, // wolfRobot learn（如有）
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 0, // 查验 villager
      });

      expect(result.completed).toBe(true);

      // 核心断言：psychicReveal 写入 BroadcastGameState
      const state = ctx.getBroadcastState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(0);
      expect(state.psychicReveal!.result).toBe('villager');
    });

    it('psychic 查验 wolf(4)，应返回 roleId "wolf"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 4, // 查验 wolf
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(4);
      expect(state.psychicReveal!.result).toBe('wolf');
    });

    it('psychic 查验 wolfRobot(7，狼阵营)，应返回 roleId "wolfRobot"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 7, // 查验 wolfRobot
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(7);
      // wolfRobot 是狼阵营，返回精确角色 roleId
      expect(state.psychicReveal!.result).toBe('wolfRobot');
    });
  });

  describe('Psychic 空选', () => {
    it('psychic 不查验时，psychicReveal 不写入或为空', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: null, // 不查验
      });

      expect(result.completed).toBe(true);

      // psychicReveal 应该为 undefined 或不包含结果
      const state = ctx.getBroadcastState();
      expect(state.psychicReveal?.result).toBeUndefined();
    });
  });

  describe('Psychic 查验好人阵营角色', () => {
    it('psychic 查验 guard(11，好人阵营)，应返回 roleId "guard"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware 断言：确认确实走到了 psychicCheck step
      expect(executeStepsUntil(ctx, 'psychicCheck')).toBe(true);
      ctx.assertStep('psychicCheck');

      // 继续执行剩余步骤
      const result = executeRemainingSteps(ctx, {
        wolfRobot: null,
        guard: 0, // guard 守人
        wolf: 1,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 11, // 查验 guard
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(11);
      // psychic 返回精确角色 roleId
      expect(state.psychicReveal!.result).toBe('guard');
    });

    it('psychic 查验 witch(9，好人阵营)，应返回 roleId "witch"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfRobot: null,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        psychic: 9, // 查验 witch
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.psychicReveal).toBeDefined();
      expect(state.psychicReveal!.targetSeat).toBe(9);
      expect(state.psychicReveal!.result).toBe('witch');
    });
  });
});

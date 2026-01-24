/**
 * Seer V2 Integration Tests
 *
 * 验证 seer 角色在 v2 架构下的完整链路：
 * - UI → PlayerMessage(ACTION) → Handler → Resolver → APPLY_RESOLVER_RESULT
 * - seerReveal 结果正确性
 * - Nightmare block 场景
 *
 * 使用 v2 harness (createHostGameV2)
 */

import { createHostGameV2 } from './hostGameFactory.v2';
import type { RoleId } from '../../../../models/roles';

describe('Seer V2 Integration', () => {
  /**
   * 简化模板：只包含 seer 和 wolf（最小可测试配置）
   * 
   * NIGHT_STEPS 顺序决定第一步：
   * - 这个模板的第一步是 wolfKill（因为 wolf 在步骤表中排在 seer 前面）
   * - 测试需要先推进到 seerCheck 步骤
   */
  const SEER_TEMPLATE: RoleId[] = [
    'seer',     // seat 0
    'wolf',     // seat 1
    'villager', // seat 2
    'villager', // seat 3
  ];

  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    SEER_TEMPLATE.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  /** 推进到 seerCheck 步骤的辅助函数 */
  function advanceToSeerStep(ctx: ReturnType<typeof createHostGameV2>): boolean {
    // 第一步是 wolfKill
    if (ctx.getBroadcastState().currentStepId === 'wolfKill') {
      // 狼空刀
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 1,
        target: -1, // 空刀
      });
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 1,
        role: 'wolf',
        target: null,
      });
      ctx.advanceNight();
    }
    
    // 现在应该在 seerCheck
    return ctx.getBroadcastState().currentStepId === 'seerCheck';
  }

  describe('seerReveal Single Source of Truth', () => {
    it('should write seerReveal to BroadcastGameState when seer checks wolf', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());

      // 推进到 seerCheck
      expect(advanceToSeerStep(ctx)).toBe(true);
      expect(ctx.getBroadcastState().currentStepId).toBe('seerCheck');

      // seer 查验 seat 1 (wolf)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      expect(result.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // result 可能是 "wolf" 或 "狼人"（取决于 resolver 实现）
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });

    it('should write seerReveal with "good" when seer checks villager', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());

      // 推进到 seerCheck
      advanceToSeerStep(ctx);

      // seer 查验 seat 2 (villager)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 2,
      });

      expect(result.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(2);
      // 预言家查验好人返回 "好人" 或 "good"
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });

    it('should allow seer to check self (neutral judge rule)', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());

      // 推进到 seerCheck
      advanceToSeerStep(ctx);

      // seer 查验自己 (seat 0)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 0,
      });

      expect(result.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });
  });

  describe('Skip Action', () => {
    it('should allow seer to skip (target=null)', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());

      // 推进到 seerCheck
      advanceToSeerStep(ctx);

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      expect(result.success).toBe(true);

      const state = ctx.getBroadcastState();
      // skip 时不应该有 seerReveal
      expect(state.seerReveal).toBeUndefined();
    });
  });

  describe('Nightmare Block Edge Cases', () => {
    // 需要包含 nightmare 的模板
    const NIGHTMARE_SEER_TEMPLATE: RoleId[] = [
      'nightmare', // seat 0
      'wolf',      // seat 1
      'seer',      // seat 2
      'villager',  // seat 3
    ];

    function createNightmareAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      NIGHTMARE_SEER_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    it('should reject blocked seer with non-skip action', () => {
      const ctx = createHostGameV2(NIGHTMARE_SEER_TEMPLATE, createNightmareAssignment());

      // 第一步是 nightmare
      expect(ctx.getBroadcastState().currentStepId).toBe('nightmareBlock');

      // nightmare 封锁 seer (seat 2)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 2,
      });

      // 验证 blockedSeat 已设置
      expect(ctx.getBroadcastState().currentNightResults?.blockedSeat).toBe(2);

      // 推进到 seer 步骤
      while (ctx.getBroadcastState().currentStepId !== 'seerCheck') {
        const currentStep = ctx.getBroadcastState().currentStepId;
        
        // 如果是 wolfKill，需要提交狼刀
        if (currentStep === 'wolfKill') {
          ctx.sendPlayerMessage({
            type: 'WOLF_VOTE',
            seat: 1,
            target: -1,
          });
          ctx.sendPlayerMessage({
            type: 'ACTION',
            seat: 1,
            role: 'wolf',
            target: null,
          });
        }
        
        const advanceResult = ctx.advanceNight();
        if (!advanceResult.success) break;
      }

      if (ctx.getBroadcastState().currentStepId === 'seerCheck') {
        // seer 尝试查验（应该被 reject）
        const result = ctx.sendPlayerMessage({
          type: 'ACTION',
          seat: 2,
          role: 'seer',
          target: 1,
        });

        expect(result.success).toBe(false);
        expect(result.reason).toContain('梦魇');
      }
    });

    it('should allow blocked seer to skip', () => {
      const ctx = createHostGameV2(NIGHTMARE_SEER_TEMPLATE, createNightmareAssignment());

      // nightmare 封锁 seer (seat 2)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 2,
      });

      // 推进到 seer 步骤
      while (ctx.getBroadcastState().currentStepId !== 'seerCheck') {
        const currentStep = ctx.getBroadcastState().currentStepId;
        
        if (currentStep === 'wolfKill') {
          ctx.sendPlayerMessage({
            type: 'WOLF_VOTE',
            seat: 1,
            target: -1,
          });
          ctx.sendPlayerMessage({
            type: 'ACTION',
            seat: 1,
            role: 'wolf',
            target: null,
          });
        }
        
        const advanceResult = ctx.advanceNight();
        if (!advanceResult.success) break;
      }

      if (ctx.getBroadcastState().currentStepId === 'seerCheck') {
        // seer 跳过（应该成功）
        const result = ctx.sendPlayerMessage({
          type: 'ACTION',
          seat: 2,
          role: 'seer',
          target: null,
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('Wire Protocol Contract', () => {
    it('seerCheck payload: target is single seat number (not encoded)', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());
      
      // 推进到 seerCheck
      advanceToSeerStep(ctx);
      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find(
        (c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION',
      );

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as { target: number | null };
      expect(msg.target).toBe(1);
      // 不是 encoded 值
      expect(msg.target).toBeLessThan(100);
    });

    it('seerCheck payload: skip has target=null', () => {
      const ctx = createHostGameV2(SEER_TEMPLATE, createRoleAssignment());
      
      // 推进到 seerCheck
      advanceToSeerStep(ctx);
      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find(
        (c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION',
      );

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as { target: number | null };
      expect(msg.target).toBeNull();
    });
  });
});

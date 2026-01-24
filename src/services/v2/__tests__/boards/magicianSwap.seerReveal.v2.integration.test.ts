/**
 * Magician Swap → Seer Reveal Regression Test
 *
 * 关键回归：确保 seer 查验在 magician 交换后使用**交换后身份**。
 *
 * 场景：
 * - 魔术师将 seat 0（原 magician）与 seat 1（原 wolf）交换
 * - 交换后：seat 0 = wolf, seat 1 = magician
 * - seer 查验 seat 0 应返回 "狼人/wolf"（因为现在是 wolf）
 * - seer 查验 seat 1 应返回 "好人/good"（因为现在是 magician）
 *
 * Wire Protocol:
 * - magician swap: target=null + extra.targets=[seatA, seatB]
 */

import { createHostGameV2 } from './hostGameFactory.v2';
import type { RoleId } from '../../../../models/roles';

/** Hard cap for step progression loops to avoid infinite loops */
const MAX_STEP_ADVANCES = 20;

describe('Magician Swap → Seer Reveal Regression', () => {
  /**
   * 模板：magician + wolf + seer + villager
   * 初始配置：
   * - seat 0: magician
   * - seat 1: wolf
   * - seat 2: seer
   * - seat 3: villager
   */
  const SWAP_TEMPLATE: RoleId[] = [
    'magician', // seat 0
    'wolf',     // seat 1
    'seer',     // seat 2
    'villager', // seat 3
  ];

  function createSwapAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    SWAP_TEMPLATE.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  /** 推进到指定步骤的辅助函数（带 hard cap） */
  function advanceToStep(
    ctx: ReturnType<typeof createHostGameV2>,
    targetStepId: string,
    handleStep?: (stepId: string) => void,
  ): void {
    for (let i = 0; i < MAX_STEP_ADVANCES; i++) {
      const currentStepId = ctx.getBroadcastState().currentStepId;
      
      if (currentStepId === targetStepId) {
        return;
      }

      // 允许调用方处理中间步骤
      if (handleStep) {
        handleStep(currentStepId!);
      }

      const result = ctx.advanceNight();
      if (!result.success) {
        break;
      }
    }

    if (ctx.getBroadcastState().currentStepId !== targetStepId) {
      throw new Error(`Failed to reach ${targetStepId} within ${MAX_STEP_ADVANCES} advances`);
    }
  }

  describe('Seer should use post-swap identity', () => {
    it('seer checks swapped seat 0 → should see wolf (original wolf was swapped to seat 0)', () => {
      const ctx = createHostGameV2(SWAP_TEMPLATE, createSwapAssignment());

      // 第一步应该是 magicianSwap
      expect(ctx.getBroadcastState().currentStepId).toBe('magicianSwap');

      // 魔术师交换 seat 0 (magician) 与 seat 1 (wolf)
      // Wire protocol: target=null, extra.targets=[seatA, seatB]
      const swapResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [0, 1] },
      });
      expect(swapResult.success).toBe(true);

      // 推进到 seerCheck，处理中间步骤（狼刀空刀）
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
          // 狼空刀
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
      });

      expect(ctx.getBroadcastState().currentStepId).toBe('seerCheck');

      // seer 查验 seat 0（交换后应该是 wolf）
      // 注意：交换后 seat 0 的角色变成了 wolf
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 0, // 查验 seat 0
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      // 关键断言：应该返回 wolf 身份（交换后身份）
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });

    it('seer checks swapped seat 1 → should see good (original magician was swapped to seat 1)', () => {
      const ctx = createHostGameV2(SWAP_TEMPLATE, createSwapAssignment());

      // 魔术师交换 seat 0 (magician) 与 seat 1 (wolf)
      const swapResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [0, 1] },
      });
      expect(swapResult.success).toBe(true);

      // 推进到 seerCheck，处理中间步骤
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
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
      });

      expect(ctx.getBroadcastState().currentStepId).toBe('seerCheck');

      // seer 查验 seat 1（交换后应该是 magician = 好人）
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 1, // 查验 seat 1
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // 关键断言：应该返回好人身份（magician 是好人阵营）
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });

    it('no swap (skip) → seer should use original identity', () => {
      const ctx = createHostGameV2(SWAP_TEMPLATE, createSwapAssignment());

      // 魔术师跳过（不交换）
      const skipResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [] }, // 空 targets 表示跳过
      });
      expect(skipResult.success).toBe(true);

      // 推进到 seerCheck
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
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
      });

      // seer 查验 seat 1（原始身份应该还是 wolf）
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 1,
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // 没有交换，seat 1 应该还是 wolf
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });
});

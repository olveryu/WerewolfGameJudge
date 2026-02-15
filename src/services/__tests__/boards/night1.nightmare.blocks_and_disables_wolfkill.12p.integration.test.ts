/**
 * Night-1 Integration Test: Nightmare Blocks Actions and Disables Wolf Kill
 *
 * 主题：梦魇阻断神职技能 + 选中狼导致禁刀。
 *
 * 模板：梦魇守卫12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: nightmare
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则（nightmare block 语义）：
 * - **被阻断玩家提交非 skip action → Host reject**（actionHandler 层 checkNightmareBlockGuard）
 * - **被阻断玩家提交 skip（target: null）→ 有效但无效果**
 * - 若 nightmare 选中狼阵营玩家：wolfKillDisabled === true，狼刀无效
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '梦魇守卫12人';

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
  map.set(7, 'nightmare');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Nightmare Blocks Actions and Disables Wolf Kill (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Nightmare 阻断狼阵营 → 禁刀', () => {
    it('nightmare 选中 wolf(4)，wolfKillDisabled=true', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 执行到 nightmareBlock 步骤
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 wolf(seat 4)
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 4,
      });
      expect(blockResult.success).toBe(true);
      ctx.advanceNight();

      // 核心断言：wolfKillDisabled = true
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfKillDisabled).toBe(true);
      expect(state.currentNightResults?.blockedSeat).toBe(4);
    });

    it('nightmare 选中 nightmare 自己(7，狼阵营)，wolfKillDisabled=true', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断自己
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 7,
      });
      expect(blockResult.success).toBe(true);
      ctx.advanceNight();

      // nightmare 是狼阵营，选中自己也触发禁刀
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfKillDisabled).toBe(true);
    });
  });

  describe('Nightmare 阻断好人阵营 → 不禁刀', () => {
    it('nightmare 选中 villager(0)，wolfKillDisabled 不设置', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 villager
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 0,
      });
      ctx.advanceNight();

      // 核心断言：wolfKillDisabled 不设置（undefined）
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfKillDisabled).toBeUndefined();
      expect(state.currentNightResults?.blockedSeat).toBe(0);
    });
  });

  describe('被阻断者提交非 skip action → reject', () => {
    it('guard 被阻断后尝试守护 → reject', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 guard(11)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 11,
      });
      ctx.advanceNight();

      // 推进到 guard 步骤
      executeStepsUntil(ctx, 'guardProtect', {});
      ctx.assertStep('guardProtect');

      // guard 尝试守护 seat 0（应该被 reject）
      const guardResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 11,
        role: 'guard',
        target: 0,
      });

      // 核心断言：被阻断后提交非 skip action 被 reject
      expect(guardResult.success).toBe(false);
      expect(guardResult.reason).toContain('梦魇封锁');
    });

    it('seer 被阻断后尝试查验 → reject', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 seer(8)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 8,
      });
      ctx.advanceNight();

      // 推进到 seer 步骤
      executeStepsUntil(ctx, 'seerCheck', {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      ctx.assertStep('seerCheck');

      // seer 尝试查验 seat 4（应该被 reject）
      const seerResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 8,
        role: 'seer',
        target: 4,
      });

      // 核心断言：被阻断后提交非 skip action 被 reject
      expect(seerResult.success).toBe(false);
      expect(seerResult.reason).toContain('梦魇封锁');
    });

    it('witch 被阻断后尝试救人 → reject', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 witch(9)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 9,
      });
      ctx.advanceNight();

      // 推进到 witch 步骤
      executeStepsUntil(ctx, 'witchAction', {
        guard: null,
        wolf: 0, // 狼刀 seat 0
      });
      ctx.assertStep('witchAction');

      // witch 尝试救 seat 0（应该被 reject）
      // 正确的 witch 消息格式：使用 stepResults
      const witchResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: 0, poison: null } },
      });

      // 核心断言：被阻断后提交非 skip action 被 reject
      expect(witchResult.success).toBe(false);
      expect(witchResult.reason).toContain('梦魇封锁');
    });
  });

  describe('被阻断者提交 skip → 有效但无效果', () => {
    it('seer 被阻断后 skip，流程继续但 seerReveal 为空', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 阻断 seer(8)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: 8,
      });
      ctx.advanceNight();

      // 推进到 seer 步骤
      executeStepsUntil(ctx, 'seerCheck', {
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      ctx.assertStep('seerCheck');

      // seer skip（被阻断后只能 skip）
      const seerResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 8,
        role: 'seer',
        target: null, // skip
      });

      // 核心断言：skip 有效
      expect(seerResult.success).toBe(true);

      // seerReveal 为空（因为 skip）
      const state = ctx.getBroadcastState();
      expect(state.seerReveal?.result).toBeUndefined();
    });
  });

  describe('Nightmare 不行动', () => {
    it('nightmare 空选，狼刀正常生效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare skip
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 7,
        role: 'nightmare',
        target: null,
      });
      ctx.advanceNight();

      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.blockedSeat).toBeUndefined();
      expect(state.currentNightResults?.wolfKillDisabled).toBeUndefined();
    });
  });
});

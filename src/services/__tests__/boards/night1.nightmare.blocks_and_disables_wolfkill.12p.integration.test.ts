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
 * ⚠️ 测试局限性说明：
 * runNight harness 不直接暴露 reject 信息，这里只能通过 state 不写入来侧面验证。
 * reject 的直接证据由 UI 测试覆盖：nightmareBlocked.ui.test.tsx 中的 actionRejected 弹窗测试。
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import type { RoleId } from '../../../models/roles';

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
    it('nightmare 选中 wolf(4)，wolfKillDisabled=true，狼刀无效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // nightmare 阻断 wolf(seat 4)
      const result = ctx.runNight({
        nightmare: 4, // 阻断 wolf
        guard: null,
        wolf: 0, // 狼刀 seat 0
        witch: { stepResults: { save: null, poison: null } },
        seer: 5,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：wolfKillDisabled = true
      expect(result.state.currentNightResults?.wolfKillDisabled).toBe(true);

      // 核心断言：狼刀无效，seat 0 不死
      expect(result.deaths).toEqual([]);

      // blockedSeat 写入
      expect(result.state.currentNightResults?.blockedSeat).toBe(4);
    });

    it('nightmare 选中 nightmare 自己(7，狼阵营)，wolfKillDisabled=true', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // nightmare 阻断自己（nightmare 也是狼阵营）
      const result = ctx.runNight({
        nightmare: 7, // 阻断自己
        guard: null,
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 5,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // nightmare 是狼阵营，选中自己也触发禁刀
      expect(result.state.currentNightResults?.wolfKillDisabled).toBe(true);
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Nightmare 阻断好人阵营 → 不禁刀', () => {
    it('nightmare 选中 villager(0)，wolfKillDisabled 不设置，狼刀正常', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 0, // 阻断 villager
        guard: null,
        wolf: 1, // 刀另一个 villager
        witch: { stepResults: { save: null, poison: null } },
        seer: 5,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：wolfKillDisabled 不设置（undefined）
      expect(result.state.currentNightResults?.wolfKillDisabled).toBeUndefined();

      // 狼刀正常生效
      expect(result.deaths).toEqual([1]);
    });

    it('nightmare 选中 seer(8)，狼刀正常生效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 8, // 阻断 seer
        guard: null,
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4, // seer 被阻断但可以提交 action
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 选中好人阵营，wolfKillDisabled 不设置（undefined）
      expect(result.state.currentNightResults?.wolfKillDisabled).toBeUndefined();
      expect(result.deaths).toEqual([0]);

      // blockedSeat 记录
      expect(result.state.currentNightResults?.blockedSeat).toBe(8);
    });
  });

  describe('Nightmare 不行动', () => {
    it('nightmare 空选，狼刀正常生效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: null, // 不阻断
        guard: null,
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      expect(result.state.currentNightResults?.blockedSeat).toBeUndefined();
      expect(result.state.currentNightResults?.wolfKillDisabled).toBeUndefined();
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('被阻断者的技能无效', () => {
    it('nightmare 阻断 guard(11)，guard 守护无效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 11, // 阻断 guard
        guard: 0, // guard 尝试守 seat 0（但会被阻断）
        wolf: 0, // 狼刀 seat 0
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：guard 被阻断，守护无效，seat 0 死亡
      expect(result.deaths).toEqual([0]);

      // blockedSeat 记录
      expect(result.state.currentNightResults?.blockedSeat).toBe(11);

      // 显式断言：guardedSeat 未写入（被 reject 导致不写入）
      expect(result.state.currentNightResults?.guardedSeat).toBeUndefined();
    });

    it('nightmare 阻断 witch(9)，witch 救/毒无效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 9, // 阻断 witch
        guard: null,
        wolf: 0, // 狼刀 seat 0
        witch: { stepResults: { save: 0, poison: null } }, // witch 尝试救（但会被阻断）
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：witch 被阻断，救人无效，seat 0 死亡
      expect(result.deaths).toEqual([0]);

      // 显式断言：savedSeat 未写入（被 reject 导致不写入）
      expect(result.state.currentNightResults?.savedSeat).toBeUndefined();
    });

    it('nightmare 阻断 witch(9)，witch 毒人无效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 9, // 阻断 witch
        guard: null,
        wolf: 0, // 狼刀 seat 0
        witch: { stepResults: { save: null, poison: 1 } }, // witch 尝试毒（但会被阻断）
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：witch 被阻断，毒人无效，只有 seat 0 死亡
      expect(result.deaths).toEqual([0]);

      // 显式断言：poisonedSeat 未写入（被 reject 导致不写入）
      expect(result.state.currentNightResults?.poisonedSeat).toBeUndefined();
    });

    it('nightmare 阻断 seer(8)，seer 查验无结果', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        nightmare: 8, // 阻断 seer
        guard: null,
        wolf: 0,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4, // seer 尝试查验（但会被阻断）
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // blockedSeat 记录
      expect(result.state.currentNightResults?.blockedSeat).toBe(8);

      // 核心断言：seer 被阻断（非 skip action 被 reject），seerReveal 未写入
      // ⚠️ reject 的直接证据由 UI 测试覆盖：nightmareBlocked.ui.test.tsx 中的 actionRejected 弹窗
      expect(result.state.seerReveal).toBeUndefined();
    });
  });
});

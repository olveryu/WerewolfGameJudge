/**
 * WolfVote Integration Tests
 *
 * Tests for wolfVote chain alignment:
 * 1. wolfVotesBySeat single source of truth verification
 * 2. Multi-wolf voting + re-voting (change vote) scenarios
 * 3. Nightmare block edge cases
 * 4. Night flow completion (not stuck after voting)
 *
 * All tests run on harness (createHostGame)
 */

import type { RoleId } from '@/models/roles';

import { createHostGame } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';

describe('WolfVote Integration Tests', () => {
  // 12人板子：含 4 个狼角色
  const TEMPLATE_ROLES: RoleId[] = [
    'villager',
    'villager',
    'villager',
    'villager', // seats 0-3
    'wolf',
    'wolf',
    'wolf',
    'darkWolfKing', // seats 4-7 (4 wolves)
    'seer',
    'witch',
    'hunter',
    'magician', // seats 8-11
  ];

  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    TEMPLATE_ROLES.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  describe('wolfVotesBySeat Single Source of Truth', () => {
    it('多狼投票后 wolfVotesBySeat 正确记录所有投票', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());

      // 运行夜晚：所有狼刀座位 0
      executeFullNight(ctx, {
        wolf: 0,
        darkWolfKing: { confirmed: true },
        seer: 8,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      // 验证 wolfVotesBySeat 单一真相
      const state = ctx.getBroadcastState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      expect(wolfVotesBySeat).toBeDefined();

      // 4 个狼（seats 4, 5, 6, 7）都应该有投票记录
      expect(wolfVotesBySeat!['4']).toBe(0);
      expect(wolfVotesBySeat!['5']).toBe(0);
      expect(wolfVotesBySeat!['6']).toBe(0);
      expect(wolfVotesBySeat!['7']).toBe(0);
    });

    it('空刀时 wolfVotesBySeat 记录 -1', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());

      // 运行夜晚：狼空刀
      executeFullNight(ctx, {
        wolf: null, // 空刀
        darkWolfKing: { confirmed: true },
        seer: 8,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      // 验证空刀记录
      const state = ctx.getBroadcastState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      // 空刀时 lead wolf 的投票应该记录为 -1
      // 注意：当前实现中，空刀时只有 lead wolf 发送 ACTION，其他狼不发 WOLF_VOTE
      // 所以可能只有 lead wolf 有记录
      expect(wolfVotesBySeat).toBeDefined();
      // At least the lead wolf should have a record
      const wolfSeats = ['4', '5', '6', '7'];
      const hasEmptyKnifeRecord = wolfSeats.some((seat) => wolfVotesBySeat![seat] === -1);
      expect(hasEmptyKnifeRecord).toBe(true);
    });

    it('投票后 night 正常结束（不会卡住）', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 2,
        darkWolfKing: { confirmed: true },
        seer: 8,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      // 夜晚应该正常结束
      expect(result.completed).toBe(true);
      // 座位 2 应该死亡（被狼刀）
      expect(result.deaths).toContain(2);
    });
  });

  describe('wolfVote Handler Contract', () => {
    // 极简模板：只有狼 + seer/witch/hunter（都在 wolfKill 之后）
    // 这样 wolfKill 就是第一步
    const SIMPLE_TEMPLATE: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'villager', // seats 0-3
      'wolf',
      'wolf', // seats 4-5
      'seer',
      'witch',
      'hunter', // seats 6-8
      'villager',
      'villager',
      'villager', // seats 9-11
    ];

    function createSimpleRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      SIMPLE_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    it('WOLF_VOTE 消息通过统一 resolver 管线处理', () => {
      const ctx = createHostGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());

      // 这个模板第一步应该是 wolfKill（没有 guard/nightmare/magician 等前置角色）
      ctx.assertStep('wolfKill');

      // 手动发送 WOLF_VOTE 消息
      const sendResult = ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4, // 第一个狼
        target: 1,
      });

      expect(sendResult.success).toBe(true);

      // 验证 wolfVotesBySeat 被更新
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(1);
    });

    it('非狼角色发送 WOLF_VOTE 被拒绝', () => {
      const ctx = createHostGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // 非狼角色尝试发送 WOLF_VOTE
      const sendResult = ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 0, // villager
        target: 1,
      });

      expect(sendResult.success).toBe(false);
      // villager 发送 WOLF_VOTE 时：
      // - 先走 validateActionPreconditions 的 step 检查
      // - villager 不满足 doesRoleParticipateInWolfVote，所以 step_mismatch
      // - 或者走到后面的 not_wolf_participant
      // 只要拒绝了就是正确行为
      expect(['step_mismatch', 'not_wolf_participant']).toContain(sendResult.reason);
    });

    it('狼可以改票（覆盖之前的投票）', () => {
      const ctx = createHostGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // 第一次投票
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 1,
      });

      // 验证第一次投票
      let state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(1);

      // 改票
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 2,
      });

      // 验证改票后的结果
      state = ctx.getBroadcastState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(2);
    });

    it('多狼分别投票，wolfVotesBySeat 正确累积', () => {
      const ctx = createHostGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // 狼 1 投票
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 0,
      });

      // 狼 2 投票不同目标
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 5,
        target: 1,
      });

      // 验证所有投票都被记录
      const state = ctx.getBroadcastState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      expect(wolfVotesBySeat).toBeDefined();
      expect(wolfVotesBySeat!['4']).toBe(0);
      expect(wolfVotesBySeat!['5']).toBe(1);
    });
  });

  describe('Nightmare Block Edge Cases', () => {
    // 带 nightmare 的板子（简化：只有 nightmare + wolf）
    const NIGHTMARE_TEMPLATE: RoleId[] = [
      'nightmare', // seat 0 (nightmare)
      'villager',
      'villager',
      'villager', // seats 1-3
      'wolf',
      'wolf', // seats 4-5
      'seer',
      'witch',
      'hunter',
      'guard', // seats 6-9
      'villager',
      'villager', // seats 10-11
    ];

    function createNightmareRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      NIGHTMARE_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    it('nightmare 封锁狼后，wolfKillDisabled 设为 true', () => {
      const ctx = createHostGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());

      // 第一步应该是 nightmare
      ctx.assertStep('nightmareBlock');

      // nightmare 封锁座位 4（第一个狼）
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 4,
      });
      expect(blockResult.success).toBe(true);

      // 验证封锁状态
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.blockedSeat).toBe(4);
      expect(state.currentNightResults?.wolfKillDisabled).toBe(true);
    });

    it('nightmare 封锁非狼角色时，wolfKillDisabled 不设置', () => {
      const ctx = createHostGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare 封锁座位 1（villager，非狼）
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 1,
      });

      // 验证狼没有被禁用
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.blockedSeat).toBe(1);
      expect(state.currentNightResults?.wolfKillDisabled).toBeFalsy();
    });

    it('nightmare 封锁后通过逐步执行完成夜晚，被封锁狼空刀', () => {
      const ctx = createHostGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());

      // 完整运行夜晚：nightmare 封锁座位 4（第一个狼）
      // 注意：被封锁的狼只能 skip（非 skip action 会被 reject）
      const result = executeFullNight(ctx, {
        nightmare: 4, // 封锁座位 4
        wolf: null, // 狼空刀（被封锁只能 skip）
        seer: 2,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        guard: 3,
      });

      // 夜晚应该完成
      expect(result.completed).toBe(true);

      // 由于狼被封锁，无人死亡
      expect(result.deaths).toEqual([]);
    });
  });
});

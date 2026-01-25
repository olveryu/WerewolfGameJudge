/**
 * Night-1 Integration Test: WolfRobot learns Hunter + Witch poison scenarios
 *
 * 主题：机械狼学习到猎人后，女巫毒与不毒他的两种结局
 *
 * 自定义模板（12人，含 wolfRobot + witch + hunter）
 * 固定 seat-role assignment:
 *   seat 0-2: villager
 *   seat 3: hunter
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: psychic
 *
 * 核心规则（WolfRobot Hunter Gate）：
 * - wolfRobot 学习 hunter 后，wolfRobotReveal.learnedRoleId === 'hunter'
 * - wolfRobotContext.disguisedRole === 'hunter'
 * - wolfRobotHunterStatusViewed 初始为 false，发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 后变为 true
 * - gate 解除后夜晚才能继续推进
 *
 * 测试风格：按 NightPlan 顺序真实执行每个 step，不跳过任何步骤
 * 使用统一 runner（stepByStepRunner.ts），禁止自造 runner
 *
 * 架构：intents → handlers → resolver → BroadcastGameState
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import {
  executeStepsUntil,
  executeRemainingSteps,
  sendMessageOrThrow,
} from './stepByStepRunner';
import type { RoleId } from '../../../models/roles';

/**
 * 自定义角色列表（含 wolfRobot + witch + hunter）
 */
const CUSTOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'hunter',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'seer',
  'witch',
  'guard',
  'psychic',
];

/**
 * 固定 seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'hunter');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'wolfRobot');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'psychic');
  return map;
}

const WOLF_ROBOT_SEAT = 7;
const HUNTER_SEAT = 3;

describe('Night-1: WolfRobot learns Hunter + Witch poison scenarios (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Hunter Gate 行为验证', () => {
    it('wolfRobot 学习 hunter 后，wolfRobotHunterStatusViewed 初始为 false，发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 后变为 true', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: 按顺序执行到 wolfRobotLearn 步骤（使用统一 runner）
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // 狼刀 villager seat 0
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: 提交 wolfRobot 学习 hunter (seat 3) 的 action（显式发送，fail-fast）
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // 断言 1: 学习事实已记录
      const stateAfterLearn = ctx.getBroadcastState();
      expect(stateAfterLearn.wolfRobotReveal).toBeDefined();
      expect(stateAfterLearn.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(stateAfterLearn.wolfRobotReveal?.targetSeat).toBe(HUNTER_SEAT);

      // 断言 2: 伪装上下文已写入
      expect(stateAfterLearn.wolfRobotContext).toBeDefined();
      expect(stateAfterLearn.wolfRobotContext?.disguisedRole).toBe('hunter');

      // 断言 3: Hunter gate 初始为 false
      expect(stateAfterLearn.wolfRobotHunterStatusViewed).toBe(false);

      // 断言 4: 当前 step 仍是 wolfRobotLearn（被 gate 阻塞）
      expect(stateAfterLearn.currentStepId).toBe('wolfRobotLearn');

      // Step 3: 尝试 advance（应该被 gate 阻塞）
      const advResultBlocked = ctx.advanceNight();
      expect(advResultBlocked.success).toBe(false);
      expect(advResultBlocked.reason).toContain('wolfrobot_hunter_status_not_viewed');

      // Step 4: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（显式发送，真实 protocol）
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      // 断言 5: gate 已解除
      const stateAfterGate = ctx.getBroadcastState();
      expect(stateAfterGate.wolfRobotHunterStatusViewed).toBe(true);

      // 断言 6: advance 不再被拒绝（可以推进到下一步）
      ctx.advanceNightOrThrow('after gate cleared');

      // 断言 7: 已推进到下一步（不再是 wolfRobotLearn）
      const stateAfterAdvance = ctx.getBroadcastState();
      expect(stateAfterAdvance.currentStepId).not.toBe('wolfRobotLearn');
    });
  });

  describe('Case A: 学到猎人 + 女巫毒他', () => {
    it('女巫毒杀学到猎人的机械狼，机械狼死亡但 wolfRobotReveal/wolfRobotContext 仍存在', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: 按顺序执行到 wolfRobotLearn 步骤
      // 女巫在前面毒 wolfRobot
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // 狼刀 villager seat 0
        witch: { save: null, poison: WOLF_ROBOT_SEAT }, // 女巫毒 wolfRobot
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: wolfRobot 学习 hunter（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // 验证学习结果
      let state = ctx.getBroadcastState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      state = ctx.getBroadcastState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // 推进到下一步
      ctx.advanceNightOrThrow('after wolfRobot gate cleared');

      // Step 4: 完成剩余步骤（使用统一 runner）
      const { deaths } = executeRemainingSteps(ctx, {
        seer: 4, // 预言家查验狼
        psychic: 5, // 通灵师查验狼
      });

      // 核心断言: wolfRobot seat 被毒死
      expect(deaths).toContain(WOLF_ROBOT_SEAT);

      // 被狼刀的 villager seat 0 也死亡
      expect(deaths).toContain(0);

      // 回归断言：毒杀不应影响 wolfRobotReveal / wolfRobotContext 的存在性
      const finalState = ctx.getBroadcastState();
      expect(finalState.wolfRobotReveal).toBeDefined();
      expect(finalState.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(finalState.wolfRobotContext).toBeDefined();
      expect(finalState.wolfRobotContext?.disguisedRole).toBe('hunter');
    });
  });

  describe('Case B: 学到猎人 + 女巫不毒他', () => {
    it('女巫不毒机械狼，机械狼存活且 wolfRobotReveal 仍存在', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: 按顺序执行到 wolfRobotLearn 步骤
      // 女巫不毒
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // 狼刀 villager seat 0
        witch: { save: null, poison: null }, // 女巫不毒
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: wolfRobot 学习 hunter（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // 验证学习结果和 gate 状态
      let state = ctx.getBroadcastState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      state = ctx.getBroadcastState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // 推进到下一步
      ctx.advanceNightOrThrow('after wolfRobot gate cleared');

      // Step 4: 完成剩余步骤（使用统一 runner）
      const { deaths } = executeRemainingSteps(ctx, {
        seer: 4,
        psychic: 5,
      });

      // 核心断言: wolfRobot seat 不在死亡列表中（仍存活）
      expect(deaths).not.toContain(WOLF_ROBOT_SEAT);

      // 被狼刀的 villager seat 0 死亡
      expect(deaths).toContain(0);

      // wolfRobotReveal 仍存在
      const finalState = ctx.getBroadcastState();
      expect(finalState.wolfRobotReveal).toBeDefined();
      expect(finalState.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(finalState.wolfRobotContext).toBeDefined();
      expect(finalState.wolfRobotContext?.disguisedRole).toBe('hunter');
    });
  });

  describe('Edge cases', () => {
    it('wolfRobot 学习非 hunter 角色时，不触发 hunter gate', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // 按顺序执行到 wolfRobotLearn 步骤（使用统一 runner）
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot 学习 villager (seat 0)（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: 0, // villager
          extra: undefined,
        },
        'wolfRobot learn villager',
      );

      const state = ctx.getBroadcastState();

      // 学习 villager，不是 hunter
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('villager');

      // 不应该触发 hunter gate（wolfRobotHunterStatusViewed 应该不存在或不为 false）
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // 可以直接 advance（不被 gate 阻塞）
      ctx.advanceNightOrThrow('after learning non-hunter');
    });

    it('wolfRobot 跳过学习时，不触发 hunter gate', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // 按顺序执行到 wolfRobotLearn 步骤（使用统一 runner）
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot 不学习（skip）（显式发送）
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: null, // 跳过
          extra: undefined,
        },
        'wolfRobot skip',
      );

      const state = ctx.getBroadcastState();

      // 没有学习，wolfRobotReveal 不应该有 learnedRoleId
      expect(state.wolfRobotReveal?.learnedRoleId).toBeUndefined();

      // 不应该触发 hunter gate
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // 可以直接 advance
      ctx.advanceNightOrThrow('after skip');
    });
  });
});


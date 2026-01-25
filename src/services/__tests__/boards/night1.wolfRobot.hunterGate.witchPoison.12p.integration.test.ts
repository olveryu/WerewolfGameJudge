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
 *
 * 架构：intents → handlers → resolver → BroadcastGameState
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import type { RoleId } from '../../../models/roles';
import type { SchemaId } from '../../../models/roles/spec';

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
const WOLF_SEAT = 4; // lead wolf
const WITCH_SEAT = 9;

/**
 * 按真实 NightPlan 顺序逐步执行到指定步骤（不跳过任何步骤）
 *
 * 对每个步骤：
 * 1. 提交该角色的 action
 * 2. 处理 reveal ack（如果需要）
 * 3. advanceNight() 到下一步
 *
 * @param ctx - HostGameContext
 * @param targetStepId - 目标步骤 ID
 * @param customActions - 自定义某些角色的 action（role -> target）
 * @returns 是否成功到达目标步骤
 */
function executeStepsUntil(
  ctx: HostGameContext,
  targetStepId: SchemaId,
  customActions: Partial<Record<RoleId, number | null>> = {},
): boolean {
  const plan = ctx.getNightPlan();
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const currentStepId = ctx.getBroadcastState().currentStepId;
    if (!currentStepId) return false;

    // 已到达目标
    if (currentStepId === targetStepId) {
      return true;
    }

    // 找到当前步骤的配置
    const stepConfig = plan.steps.find((s) => s.stepId === currentStepId);
    if (!stepConfig) return false;

    const roleId = stepConfig.roleId;
    const actorSeat = ctx.findSeatByRole(roleId);
    if (actorSeat === -1) {
      // 该角色不在模板中，直接推进
      ctx.advanceNight();
      continue;
    }

    // 获取 action target（使用 customActions 或 null）
    const target = customActions[roleId] ?? null;

    // 根据步骤类型提交 action
    if (currentStepId === 'wolfKill') {
      // 狼杀需要先投票再提交 action
      if (target !== null) {
        // 所有狼投票
        for (let seat = 4; seat <= 7; seat++) {
          const role = ctx.getRoleAtSeat(seat);
          if (role === 'wolf' || role === 'wolfRobot') {
            ctx.sendPlayerMessage({
              type: 'WOLF_VOTE',
              seat,
              target,
            });
          }
        }
      }
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_SEAT,
        role: 'wolf',
        target,
        extra: undefined,
      });
    } else if (currentStepId === 'witchAction') {
      // 女巫使用 compound schema
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WITCH_SEAT,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: null } },
      });
    } else if (currentStepId === 'hunterConfirm' || currentStepId === 'darkWolfKingConfirm') {
      // 确认类 schema
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: actorSeat,
        role: roleId,
        target: null,
        extra: { confirmed: false },
      });
    } else {
      // 其他普通 action
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: actorSeat,
        role: roleId,
        target,
        extra: undefined,
      });
    }

    // 处理 reveal ack
    if (ctx.getBroadcastState().pendingRevealAcks?.length) {
      ctx.sendPlayerMessage({
        type: 'REVEAL_ACK',
        seat: actorSeat,
        role: roleId,
        revision: ctx.getRevision(),
      });
    }

    // 推进到下一步
    ctx.advanceNight();
  }

  return false;
}

/**
 * 从当前步骤继续执行到 Night-1 结束
 *
 * @param ctx - HostGameContext
 * @param customActions - 自定义某些角色的 action
 */
function executeRemainingSteps(
  ctx: HostGameContext,
  customActions: Partial<
    Record<RoleId, number | null | { save: number | null; poison: number | null }>
  > = {},
): { deaths: number[] } {
  const plan = ctx.getNightPlan();
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const state = ctx.getBroadcastState();
    const currentStepId = state.currentStepId;

    // Night 已结束
    if (!currentStepId || state.status === 'ended') {
      return { deaths: state.lastNightDeaths ?? [] };
    }

    // 找到当前步骤的配置
    const stepConfig = plan.steps.find((s) => s.stepId === currentStepId);
    if (!stepConfig) break;

    const roleId = stepConfig.roleId;
    const actorSeat = ctx.findSeatByRole(roleId);
    if (actorSeat === -1) {
      ctx.advanceNight();
      continue;
    }

    // 获取 action target
    const actionValue = customActions[roleId];
    const target = typeof actionValue === 'number' ? actionValue : null;

    // 根据步骤类型提交 action
    if (currentStepId === 'wolfKill') {
      if (target !== null) {
        for (let seat = 4; seat <= 7; seat++) {
          const role = ctx.getRoleAtSeat(seat);
          if (role === 'wolf' || role === 'wolfRobot') {
            ctx.sendPlayerMessage({
              type: 'WOLF_VOTE',
              seat,
              target,
            });
          }
        }
      }
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_SEAT,
        role: 'wolf',
        target,
        extra: undefined,
      });
    } else if (currentStepId === 'witchAction') {
      const witchAction = customActions['witch'];
      let stepResults = { save: null as number | null, poison: null as number | null };
      if (witchAction && typeof witchAction === 'object' && 'poison' in witchAction) {
        stepResults = witchAction;
      }
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WITCH_SEAT,
        role: 'witch',
        target: null,
        extra: { stepResults },
      });
    } else if (currentStepId === 'hunterConfirm' || currentStepId === 'darkWolfKingConfirm') {
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: actorSeat,
        role: roleId,
        target: null,
        extra: { confirmed: false },
      });
    } else if (currentStepId === 'wolfRobotLearn') {
      // wolfRobot 学习步骤
      const wolfRobotTarget = typeof customActions['wolfRobot'] === 'number'
        ? customActions['wolfRobot']
        : null;
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: wolfRobotTarget,
        extra: undefined,
      });

      // 处理 hunter gate（如果学到 hunter）
      const stateAfter = ctx.getBroadcastState();
      if (
        stateAfter.wolfRobotReveal?.learnedRoleId === 'hunter' &&
        stateAfter.wolfRobotHunterStatusViewed === false
      ) {
        ctx.sendPlayerMessage({
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        });
      }
    } else {
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: actorSeat,
        role: roleId,
        target,
        extra: undefined,
      });
    }

    // 处理 reveal ack
    if (ctx.getBroadcastState().pendingRevealAcks?.length) {
      ctx.sendPlayerMessage({
        type: 'REVEAL_ACK',
        seat: actorSeat,
        role: roleId,
        revision: ctx.getRevision(),
      });
    }

    // 检查是否是最后一步
    const currentIdx = plan.steps.findIndex((s) => s.stepId === currentStepId);
    if (currentIdx === plan.steps.length - 1) {
      // 最后一步完成后，advanceNight() 让 currentStepId 变成 undefined
      ctx.advanceNight();
      // 然后 endNight() 触发死亡结算
      const result = ctx.endNight();
      return { deaths: result.deaths };
    }

    ctx.advanceNight();
  }

  // 如果因为其他原因退出循环，尝试结束夜晚
  const state = ctx.getBroadcastState();
  if (!state.currentStepId && state.status !== 'ended') {
    const result = ctx.endNight();
    return { deaths: result.deaths };
  }

  return { deaths: state.lastNightDeaths ?? [] };
}

describe('Night-1: WolfRobot learns Hunter + Witch poison scenarios (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Hunter Gate 行为验证', () => {
    it('wolfRobot 学习 hunter 后，wolfRobotHunterStatusViewed 初始为 false，发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 后变为 true', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: 按顺序执行到 wolfRobotLearn 步骤（不跳过任何步骤）
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // 狼刀 villager seat 0
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: 提交 wolfRobot 学习 hunter (seat 3) 的 action
      const learnResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: HUNTER_SEAT,
        extra: undefined,
      });
      expect(learnResult.success).toBe(true);

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

      // Step 3: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（真实 protocol）
      const gateResult = ctx.sendPlayerMessage({
        type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: WOLF_ROBOT_SEAT,
      });
      expect(gateResult.success).toBe(true);

      // 断言 5: gate 已解除
      const stateAfterGate = ctx.getBroadcastState();
      expect(stateAfterGate.wolfRobotHunterStatusViewed).toBe(true);

      // 断言 6: advance 不再被拒绝（可以推进到下一步）
      const advResult = ctx.advanceNight();
      expect(advResult.success).toBe(true);

      // 断言 7: 已推进到下一步（不再是 wolfRobotLearn）
      const stateAfterAdvance = ctx.getBroadcastState();
      expect(stateAfterAdvance.currentStepId).not.toBe('wolfRobotLearn');
    });
  });

  describe('Case A: 学到猎人 + 女巫毒他', () => {
    it('女巫毒杀学到猎人的机械狼，机械狼死亡但 wolfRobotReveal/wolfRobotContext 仍存在', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: 按顺序执行到 witchAction 步骤
      const reachedWitch = executeStepsUntil(ctx, 'witchAction', {
        wolf: 0, // 狼刀 villager seat 0
      });
      expect(reachedWitch).toBe(true);
      ctx.assertStep('witchAction');

      // Step 2: 女巫毒 wolfRobot (seat 7)
      const witchResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WITCH_SEAT,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: WOLF_ROBOT_SEAT } },
      });
      expect(witchResult.success).toBe(true);
      ctx.advanceNight();

      // Step 3: 继续执行到 wolfRobotLearn 步骤
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn');
      expect(reachedWolfRobot).toBe(true);

      // Step 4: wolfRobot 学习 hunter
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: HUNTER_SEAT,
        extra: undefined,
      });

      // 验证学习结果
      let state = ctx.getBroadcastState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 5: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（真实 protocol）
      ctx.sendPlayerMessage({
        type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: WOLF_ROBOT_SEAT,
      });

      state = ctx.getBroadcastState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // 推进并完成剩余步骤
      ctx.advanceNight();
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

      // Step 1: 按顺序执行到 witchAction 步骤
      const reachedWitch = executeStepsUntil(ctx, 'witchAction', {
        wolf: 0, // 狼刀 villager seat 0
      });
      expect(reachedWitch).toBe(true);

      // Step 2: 女巫不使用毒药
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WITCH_SEAT,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: null } },
      });
      ctx.advanceNight();

      // Step 3: 继续执行到 wolfRobotLearn 步骤
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn');
      expect(reachedWolfRobot).toBe(true);

      // Step 4: wolfRobot 学习 hunter
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: HUNTER_SEAT,
        extra: undefined,
      });

      // 验证学习结果和 gate 状态
      let state = ctx.getBroadcastState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 5: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 解除 gate（真实 protocol）
      ctx.sendPlayerMessage({
        type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: WOLF_ROBOT_SEAT,
      });

      state = ctx.getBroadcastState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // 推进并完成剩余步骤
      ctx.advanceNight();
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

      // 按顺序执行到 wolfRobotLearn 步骤
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot 学习 villager (seat 0)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: 0, // villager
        extra: undefined,
      });

      const state = ctx.getBroadcastState();

      // 学习 villager，不是 hunter
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('villager');

      // 不应该触发 hunter gate（wolfRobotHunterStatusViewed 应该不存在或不为 false）
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // 可以直接 advance（不被 gate 阻塞）
      const advResult = ctx.advanceNight();
      expect(advResult.success).toBe(true);
    });

    it('wolfRobot 跳过学习时，不触发 hunter gate', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // 按顺序执行到 wolfRobotLearn 步骤
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot 不学习（skip）
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: WOLF_ROBOT_SEAT,
        role: 'wolfRobot',
        target: null, // 跳过
        extra: undefined,
      });

      const state = ctx.getBroadcastState();

      // 没有学习，wolfRobotReveal 不应该有 learnedRoleId
      expect(state.wolfRobotReveal?.learnedRoleId).toBeUndefined();

      // 不应该触发 hunter gate
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // 可以直接 advance
      const advResult = ctx.advanceNight();
      expect(advResult.success).toBe(true);
    });
  });
});

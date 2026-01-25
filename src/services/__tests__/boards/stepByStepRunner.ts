/**
 * Step-by-Step Night Runner
 *
 * 按真实 NightPlan 顺序逐步执行夜晚流程（禁止一键跑完）
 *
 * 硬性要求：
 * 1. 每个步骤必须：提交真实 PlayerMessage.ACTION → advanceNight()
 * 2. 任何 gate（如 wolfRobotHunterStatusViewed）都必须由测试显式发送消息解除
 * 3. 禁止 helper 自动发送任何确认/ack 类消息
 * 4. 每次 sendPlayerMessage / advanceNight 必须 fail-fast（失败即 throw）
 */

import type { HostGameContext } from './hostGameFactory';
import type { RoleId } from '../../../models/roles';
import { doesRoleParticipateInWolfVote } from '../../../models/roles';
import type { SchemaId } from '../../../models/roles/spec';
import type { PlayerMessage } from '../../protocol/types';

// =============================================================================
// Fail-Fast Helper
// =============================================================================

/**
 * 发送 PlayerMessage 并 fail-fast（失败即 throw）
 *
 * Runner 内所有 sendPlayerMessage 必须通过此函数发送
 */
function sendMessageOrThrow(
  ctx: HostGameContext,
  message: PlayerMessage,
  context: { stepId?: SchemaId | null },
): void {
  const result = ctx.sendPlayerMessage(message);
  if (!result.success) {
    const stepInfo = context.stepId ? ` at step "${context.stepId}"` : '';
    throw new Error(
      `[stepByStepRunner] sendPlayerMessage failed${stepInfo}: ` +
        `type=${message.type}, seat=${'seat' in message ? message.seat : 'N/A'}, ` +
        `reason=${result.reason ?? 'unknown'}`,
    );
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * 自定义 action 配置
 *
 * 支持的值类型：
 * - number: 目标座位
 * - null: 空刀/不行动
 * - { save: number | null; poison: number | null }: 女巫 compound action
 * - { targets: number[] }: 魔术师交换
 * - { confirmed: boolean }: 确认类 action
 */
export type ActionValue =
  | number
  | null
  | { save: number | null; poison: number | null }
  | { targets: readonly number[] }
  | { confirmed: boolean };

export type CustomActions = Partial<Record<RoleId, ActionValue>>;

/**
 * 执行结果
 */
export interface StepByStepResult {
  /** 最终死亡列表 */
  deaths: number[];
  /** 夜晚是否完成 */
  completed: boolean;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * 按真实 NightPlan 顺序逐步执行到指定步骤（不跳过任何步骤）
 *
 * 对每个步骤：
 * 1. 提交该角色的 action
 * 2. advanceNight() 到下一步
 *
 * ⚠️ 任何 gate（如 pendingRevealAcks / wolfRobotHunterStatusViewed）
 *    必须由测试在 customActions 回调中显式发送消息解除
 *
 * @param ctx - HostGameContext
 * @param targetStepId - 目标步骤 ID
 * @param customActions - 自定义某些角色的 action
 * @returns 是否成功到达目标步骤
 * @throws 如果 advanceNight 失败
 */
export function executeStepsUntil(
  ctx: HostGameContext,
  targetStepId: SchemaId,
  customActions: CustomActions = {},
): boolean {
  const MAX_ITERATIONS = 30;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const state = ctx.getBroadcastState();
    const currentStepId = state.currentStepId;
    if (!currentStepId) return false;

    // 已到达目标
    if (currentStepId === targetStepId) {
      return true;
    }

    // 执行当前步骤
    executeCurrentStep(ctx, customActions);

    // 推进到下一步（fail-fast）
    const advanceResult = ctx.advanceNight();
    if (!advanceResult.success) {
      throw new Error(
        `[stepByStepRunner] advanceNight failed at step "${currentStepId}": ${advanceResult.reason ?? 'unknown'}`,
      );
    }
  }

  return false;
}

/**
 * 从当前步骤继续执行到 Night-1 结束
 *
 * ⚠️ 任何 gate（如 pendingRevealAcks / wolfRobotHunterStatusViewed）
 *    必须由测试在 customActions 回调中显式发送消息解除
 *
 * @param ctx - HostGameContext
 * @param customActions - 自定义某些角色的 action
 * @returns 执行结果
 * @throws 如果 advanceNight 失败
 */
export function executeRemainingSteps(
  ctx: HostGameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  const MAX_ITERATIONS = 30;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const state = ctx.getBroadcastState();
    const currentStepId = state.currentStepId;

    // Night 已结束（currentStepId 为空）
    if (!currentStepId) {
      // 触发死亡结算
      const result = ctx.endNight();
      return {
        deaths: result.deaths,
        completed: true,
      };
    }

    // 检查是否已经结束
    if (state.status === 'ended') {
      return {
        deaths: state.lastNightDeaths ?? [],
        completed: true,
      };
    }

    // 执行当前步骤
    executeCurrentStep(ctx, customActions);

    // 推进到下一步（fail-fast）
    const advanceResult = ctx.advanceNight();
    if (!advanceResult.success) {
      throw new Error(
        `[stepByStepRunner] advanceNight failed at step "${currentStepId}": ${advanceResult.reason ?? 'unknown'}`,
      );
    }
  }

  // 超出最大迭代次数，触发结束
  const result = ctx.endNight();
  return {
    deaths: result.deaths,
    completed: true,
  };
}

/**
 * 执行完整的 Night-1 流程（从头到尾逐步执行）
 *
 * @param ctx - HostGameContext
 * @param customActions - 自定义某些角色的 action
 * @returns 执行结果
 */
export function executeFullNight(
  ctx: HostGameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  return executeRemainingSteps(ctx, customActions);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 执行当前步骤（不推进）
 *
 * 仅提交当前步骤的 action。
 *
 * ⚠️ 任何 gate（如 pendingRevealAcks / wolfRobotHunterStatusViewed）
 *    必须由测试在 customActions 回调中显式发送消息解除
 */
function executeCurrentStep(
  ctx: HostGameContext,
  customActions: CustomActions,
): void {
  const plan = ctx.getNightPlan();
  const state = ctx.getBroadcastState();
  const currentStepId = state.currentStepId;
  if (!currentStepId) return;

  // 找到当前步骤的配置
  const stepConfig = plan.steps.find((s) => s.stepId === currentStepId);
  if (!stepConfig) return;

  const roleId = stepConfig.roleId;
  const actorSeat = ctx.findSeatByRole(roleId);

  // 该角色不在模板中，跳过（advanceNight 会在外层调用）
  if (actorSeat === -1) {
    return;
  }

  // 获取自定义 action
  const actionValue = customActions[roleId];

  // 根据步骤类型提交 action
  submitActionForStep(ctx, currentStepId, roleId, actorSeat, actionValue);

  // ⚠️ 注意：reveal ack / wolfRobot hunter gate 等确认消息
  // 必须由测试在 customActions 中显式处理，不在此自动发送
}

/**
 * 根据步骤类型提交对应的 action
 */
function submitActionForStep(
  ctx: HostGameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  if (stepId === 'wolfKill') {
    submitWolfKillAction(ctx, stepId, actorSeat, actionValue);
  } else if (stepId === 'witchAction') {
    submitWitchAction(ctx, stepId, actorSeat, actionValue);
  } else if (stepId === 'magicianSwap') {
    submitMagicianSwapAction(ctx, stepId, actorSeat, actionValue);
  } else if (stepId === 'hunterConfirm' || stepId === 'darkWolfKingConfirm') {
    submitConfirmAction(ctx, stepId, roleId, actorSeat, actionValue);
  } else {
    // 普通 action（seer, guard, nightmare, etc.）
    submitNormalAction(ctx, stepId, roleId, actorSeat, actionValue);
  }
}

/**
 * 提交狼刀 action
 */
function submitWolfKillAction(
  ctx: HostGameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  const target = typeof actionValue === 'number' ? actionValue : null;
  const state = ctx.getBroadcastState();

  // 所有参与狼刀的狼投票（fail-fast）
  // 注意：只有 participatesInWolfVote=true 的角色才发送 WOLF_VOTE
  if (target !== null) {
    for (const [seatStr, player] of Object.entries(state.players)) {
      const seat = Number.parseInt(seatStr, 10);
      const role = player?.role;
      if (role && doesRoleParticipateInWolfVote(role)) {
        sendMessageOrThrow(
          ctx,
          {
            type: 'WOLF_VOTE',
            seat,
            target,
          },
          { stepId },
        );
      }
    }
  }

  // 找到 lead wolf seat（参与狼刀的第一个狼）
  let leadWolfSeat = actorSeat;
  let leadWolfRole: RoleId = 'wolf';
  for (const [seatStr, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatStr, 10);
    const role = player?.role;
    // 只有 participatesInWolfVote=true 的角色能成为 lead wolf
    if (role && doesRoleParticipateInWolfVote(role)) {
      leadWolfSeat = seat;
      leadWolfRole = role;
      break;
    }
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: leadWolfSeat,
      role: leadWolfRole,
      target,
      extra: undefined,
    },
    { stepId },
  );
}

/**
 * 提交女巫 action
 */
function submitWitchAction(
  ctx: HostGameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let stepResults = { save: null as number | null, poison: null as number | null };

  if (actionValue && typeof actionValue === 'object' && 'save' in actionValue) {
    stepResults = actionValue as { save: number | null; poison: number | null };
  } else if (typeof actionValue === 'number') {
    // 单个数字表示救人
    stepResults = { save: actionValue, poison: null };
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: 'witch',
      target: null,
      extra: { stepResults },
    },
    { stepId },
  );
}

/**
 * 提交魔术师交换 action
 */
function submitMagicianSwapAction(
  ctx: HostGameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let targets: readonly number[] = [];

  if (actionValue && typeof actionValue === 'object' && 'targets' in actionValue) {
    targets = actionValue.targets;
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: 'magician',
      target: null,
      extra: targets.length > 0 ? { targets } : undefined,
    },
    { stepId },
  );
}

/**
 * 提交确认类 action
 *
 * 默认 confirmed = true（正常情况下确认通过）
 * 如果测试需要跳过（confirmed: false），必须显式指定
 */
function submitConfirmAction(
  ctx: HostGameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  // 默认 true：正常情况下确认步骤需要 confirmed: true
  let confirmed = true;

  if (actionValue && typeof actionValue === 'object' && 'confirmed' in actionValue) {
    confirmed = actionValue.confirmed;
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target: null,
      extra: { confirmed },
    },
    { stepId },
  );
}

/**
 * 提交普通 action
 */
function submitNormalAction(
  ctx: HostGameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  const target = typeof actionValue === 'number' ? actionValue : null;

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target,
      extra: undefined,
    },
    { stepId },
  );
}

// ⚠️ 已删除 handleRevealAck / handleWolfRobotHunterGate
// 所有确认类消息必须由测试在 customActions 回调中显式发送


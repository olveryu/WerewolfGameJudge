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
 * 5. advanceNightOrThrow 的单一实现来源是 ctx.advanceNightOrThrow()（在 hostGameFactory.ts）
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { doesRoleParticipateInWolfVote } from '@werewolf/game-engine/models/roles';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { PlayerMessage } from '@werewolf/game-engine/protocol/types';

import type { HostGameContext } from './hostGameContext';

// =============================================================================
// Fail-Fast Helpers (Exported for direct use in tests)
// =============================================================================

/**
 * 发送 PlayerMessage 并 fail-fast（失败即 throw）
 *
 * 这是所有 board integration tests 发送消息的单一 fail-fast 来源。
 * 禁止在测试文件或其他地方自行实现类似的 helper，以防止 drift。
 *
 * ⚠️ 硬性要求：
 * - 此函数不会自动发送任何 ack/gate 消息
 * - 所有 gate（REVEAL_ACK / WOLF_ROBOT_HUNTER_STATUS_VIEWED）必须由测试显式发送
 *
 * @param ctx - HostGameContext
 * @param message - PlayerMessage 消息
 * @param context - 上下文信息（用于错误消息）
 * @throws 如果 sendPlayerMessage 返回 success: false
 */
export function sendMessageOrThrow(
  ctx: HostGameContext,
  message: PlayerMessage,
  context: string | { stepId?: SchemaId | null },
): void {
  const result = ctx.sendPlayerMessage(message);
  if (!result.success) {
    let contextStr: string;
    if (typeof context === 'string') {
      contextStr = context;
    } else if (context.stepId) {
      contextStr = `step "${context.stepId}"`;
    } else {
      contextStr = 'unknown step';
    }
    throw new Error(
      `[sendMessageOrThrow] failed at ${contextStr}: ` +
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

    // 推进到下一步（使用 ctx.advanceNightOrThrow - 单一实现来源）
    ctx.advanceNightOrThrow(`executeStepsUntil step "${currentStepId}"`);
  }

  return false;
}

/**
 * 从当前步骤继续执行到 Night-1 结束
 *
 * 语义：从当前 `BroadcastGameState.currentStepId` 接着往后逐步执行，直到 Night-1 结束。
 * 支持先 `executeStepsUntil` 到某个步骤，再调用本函数继续跑完剩余流程。
 *
 * ⚠️ 硬性要求（MUST follow）：
 * - 本函数不会自动发送任何 ack/gate 消息
 * - 任何 gate（如 pendingRevealAcks / wolfRobotHunterStatusViewed）
 *   必须由测试显式发送对应消息解除
 * - 遇到 gate 阻塞时会 throw（fail-fast），不会自动处理
 *
 * @param ctx - HostGameContext
 * @param customActions - 自定义某些角色的 action
 * @returns 执行结果（deaths 列表 + 是否完成）
 * @throws 如果 advanceNight 失败（包括被 gate 阻塞）
 * @throws 如果 state.status !== 'ongoing' 且 currentStepId 存在（状态不一致）
 */
export function executeRemainingSteps(
  ctx: HostGameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  const MAX_ITERATIONS = 30;

  // Fail-fast 校验：状态必须合法（只读校验，不修改 state）
  const initialState = ctx.getBroadcastState();
  if (initialState.currentStepId && initialState.status !== 'ongoing') {
    throw new Error(
      `[executeRemainingSteps] Invalid state: currentStepId="${initialState.currentStepId}" ` +
        `but status="${initialState.status}" (expected "ongoing"). ` +
        `Night flow may have been corrupted.`,
    );
  }

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

    // 推进到下一步（使用 ctx.advanceNightOrThrow - 单一实现来源）
    ctx.advanceNightOrThrow(`executeRemainingSteps step "${currentStepId}"`);
  }

  // 超出最大迭代次数，触发结束
  const result = ctx.endNight();
  return {
    deaths: result.deaths,
    completed: true,
  };
}

/**
 * 执行完整的 Night-1 流程（测试意图层别名）
 *
 * ⚠️ 这是 `executeRemainingSteps` 的薄封装，用于提升测试可读性。
 *
 * ⚠️ 硬性护栏（MUST follow）：
 * - 本函数**不会** start night、不会重置 state
 * - 本函数**不会**自动处理任何 ack/gate，包括：
 *   - pendingRevealAcks（需要测试显式发送 REVEAL_ACK）
 *   - wolfRobotHunterStatusViewed（需要测试显式发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED）
 * - gate 必须由测试显式发送对应消息解除
 * - 遇到 gate 阻塞时会 throw（fail-fast），不会自动处理
 *
 * 禁止在本函数内新增：
 * - 自动发 REVEAL_ACK / WOLF_ROBOT_HUNTER_STATUS_VIEWED
 * - 自动清任何 gate
 * - 自动 skip step / fast-forward / jump
 * - 任何"遇到 gate 就帮忙处理"的逻辑
 *
 * @param ctx - HostGameContext
 * @param customActions - 自定义某些角色的 action
 * @returns 执行结果（deaths 列表 + 是否完成）
 * @throws 如果 advanceNight 失败（包括被 gate 阻塞）
 */
export function executeFullNight(
  ctx: HostGameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  // 薄封装：只调用 executeRemainingSteps，禁止添加任何额外逻辑
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
function executeCurrentStep(ctx: HostGameContext, customActions: CustomActions): void {
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

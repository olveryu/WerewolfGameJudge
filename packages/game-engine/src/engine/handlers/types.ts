/**
 * Handler Types - 处理器类型定义
 *
 * Handler 负责：
 * 1. 验证 Intent
 * 2. 调用 Resolver（如果需要）
 * 3. 返回 StateAction 列表
 */

import type { StateAction } from '../reducer/types';
import type { GameState } from '../store/types';

/**
 * Handler 上下文
 * 提供 handler 执行所需的依赖
 *
 * 注意：state 和 myUserId 可能为 null（Facade 不做校验，由 handler 负责）
 */
export interface HandlerContext {
  /** 当前状态（只读，可能为 null） */
  readonly state: GameState | null;

  /** 当前用户 UID（可能为 null） */
  readonly myUserId: string | null;

  /** 当前用户座位号 */
  readonly mySeat: number | null;
}

/**
 * Handler 结果 — discriminated union
 *
 * 三种结果语义：
 * - `success`：正常完成，有 actions 需要 apply + persist + broadcast
 * - `rejection`：业务拒绝（如免疫袭击），有 actions（ACTION_REJECTED 等）需要 persist + broadcast
 * - `error`：基础设施/前置条件失败（state 不存在、状态不对），无 actions，直接返回 HTTP 错误
 */
export type HandlerResult = HandlerSuccess | HandlerRejection | HandlerError;

export interface HandlerSuccess {
  readonly kind: 'success';
  readonly actions: StateAction[];
  readonly sideEffects?: readonly SideEffect[];
  /** 可选元信息（如 'DEDUPLICATED'），不影响 success 语义，供客户端 toast 使用 */
  readonly reason?: string;
}

export interface HandlerRejection {
  readonly kind: 'rejection';
  readonly reason: string;
  readonly actions: StateAction[];
  readonly sideEffects?: readonly SideEffect[];
}

export interface HandlerError {
  readonly kind: 'error';
  readonly reason: string;
}

// ── Factory functions ───────────────────────────────────────────────────────

export function handlerSuccess(
  actions: StateAction[],
  sideEffects?: readonly SideEffect[],
  reason?: string,
): HandlerSuccess {
  return { kind: 'success', actions, sideEffects, reason };
}

export function handlerRejection(
  reason: string,
  actions: StateAction[],
  sideEffects?: readonly SideEffect[],
): HandlerRejection {
  return { kind: 'rejection', reason, actions, sideEffects };
}

export function handlerError(reason: string): HandlerError {
  return { kind: 'error', reason };
}

/**
 * 副作用类型
 * Handler 不直接执行副作用，而是返回描述，由外层执行
 */
export type SideEffect =
  | { type: 'BROADCAST_STATE' }
  | { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean }
  | { type: 'SEND_MESSAGE'; message: unknown }
  | { type: 'SAVE_STATE' };

/**
 * 标准副作用：广播状态 + 保存状态
 *
 * 大多数 handler 的 sideEffects 都是这对组合。
 * 包含 PLAY_AUDIO 的 handler 应自行构造完整列表。
 */
export const STANDARD_SIDE_EFFECTS: readonly SideEffect[] = Object.freeze([
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
] as const);

/**
 * 非 null 的 GameState 类型（通过 handler validation 后使用）
 */
export type NonNullState = NonNullable<HandlerContext['state']>;

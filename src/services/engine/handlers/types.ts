/**
 * Handler Types - 处理器类型定义
 *
 * Handler 负责：
 * 1. 验证 Intent
 * 2. 调用 Resolver（如果需要）
 * 3. 返回 StateAction 列表
 */

import type { StateAction } from '@/services/engine/reducer/types';
import type { GameState } from '@/services/engine/store/types';

/**
 * Handler 上下文
 * 提供 handler 执行所需的依赖
 *
 * 注意：state 和 myUid 可能为 null（Facade 不做校验，由 handler 负责）
 */
export interface HandlerContext {
  /** 当前状态（只读，可能为 null） */
  readonly state: GameState | null;

  /** 当前用户是否是主机 */
  readonly isHost: boolean;

  /** 当前用户 UID（可能为 null） */
  readonly myUid: string | null;

  /** 当前用户座位号 */
  readonly mySeat: number | null;
}

/**
 * Handler 结果
 */
export interface HandlerResult {
  /** 是否成功 */
  success: boolean;

  /** 失败原因 */
  reason?: string;

  /** 要执行的 StateAction 列表 */
  actions: StateAction[];

  /** 副作用（如需要播放音频、发送消息等） */
  sideEffects?: SideEffect[];
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


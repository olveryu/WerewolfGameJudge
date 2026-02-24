/**
 * Host Game Context Types
 *
 * 纯类型文件，用于打破 stepByStepRunner ↔ hostGameFactory 循环依赖。
 * 只包含 type/interface，不包含实现代码。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { NightPlan } from '@werewolf/game-engine/models/roles/spec/plan';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState, PlayerMessage } from '@werewolf/game-engine/protocol/types';

// =============================================================================
// Types
// =============================================================================

/**
 * 捕获的消息记录（用于 wire protocol 合约测试）
 */
export interface CapturedMessage {
  /** 消息发送时的 currentStepId */
  stepId: SchemaId | null;
  /** 原始 PlayerMessage */
  message: PlayerMessage;
}

/**
 * Host Game Context
 *
 * Integration tests 使用的游戏上下文接口。
 * 实现在 hostGameFactory.ts 的 createHostGame() 中。
 */
export interface HostGameContext {
  /** 获取当前 GameState */
  getGameState: () => GameState;
  /** 获取当前 revision */
  getRevision: () => number;
  /** 获取 NightPlan */
  getNightPlan: () => NightPlan;
  /** 发送 PlayerMessage（模拟 player→host intent） */
  sendPlayerMessage: (msg: PlayerMessage) => { success: boolean; reason?: string };
  /** 推进到下一个夜晚步骤 */
  advanceNight: () => { success: boolean; reason?: string };
  /**
   * 推进到下一个夜晚步骤（fail-fast 版本）
   *
   * 这是所有 board integration tests 的**单一 fail-fast 实现来源**。
   * 实现在 hostGameFactory.ts 中。
   *
   * ⚠️ 硬性要求：
   * - 禁止在测试文件或 runner 中自行实现类似的 helper
   * - 此函数不会自动发送任何 ack/gate 消息
   * - 遇到 gate 阻塞时会 throw，不会自动处理
   *
   * @param context - 上下文信息（用于错误消息）
   * @throws 如果 advanceNight 返回 success: false
   */
  advanceNightOrThrow: (context: string) => void;
  /** 结束夜晚，触发死亡结算 */
  endNight: () => { success: boolean; deaths: number[] };
  /** 断言当前步骤 */
  assertStep: (expectedStepId: SchemaId) => void;
  /** 查找角色的座位号 */
  findSeatByRole: (role: RoleId) => number;
  /** 获取座位的角色 */
  getRoleAtSeat: (seat: number) => RoleId | null;
  /** 获取模板 */
  template: GameTemplate;
  /** 获取捕获的消息（用于 wire protocol 合约测试） */
  getCapturedMessages: () => readonly CapturedMessage[];
  /** 清空捕获的消息 */
  clearCapturedMessages: () => void;
}

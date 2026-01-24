/**
 * Witch Context - 女巫上下文计算
 *
 * 纯函数模块，负责：
 * - 计算女巫行动时所需的上下文（killedIndex, canSave, canPoison）
 * - 判断是否需要设置 witchContext 并返回 action
 *
 * 设计原则：
 * - 单一真相：witchContext 只存在于 BroadcastGameState.witchContext
 * - 纯函数：不 IO、不读外部、不写 state
 * - Schema-first：canSave 逻辑与 witchAction.steps[0].constraints['notSelf'] 对齐
 * - Night-1-only：canPoison 总是 true（项目规则：Night-1 毒药可用）
 */

import type { SchemaId } from '../../../models/roles/spec';
import type { SetWitchContextAction } from '../reducer/types';
import type { BroadcastGameState } from '../../protocol/types';
import { resolveWolfVotes } from '../../resolveWolfVotes';

/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<BroadcastGameState>;

/**
 * 计算女巫上下文（纯函数）
 *
 * 在进入 witchAction 步骤前调用，统一计算：
 * - killedIndex: 狼刀目标（-1 表示无人死亡）
 * - canSave: 是否可以使用解药
 * - canPoison: 是否可以使用毒药
 *
 * @param state 当前游戏状态
 * @returns witchContext payload
 */
export function computeWitchContext(state: NonNullState): {
  killedIndex: number;
  canSave: boolean;
  canPoison: boolean;
} {
  // 1. 计算狼刀目标（killedIndex）
  let killedIndex = -1;

  if (!state.wolfKillDisabled) {
    const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
    const votes = new Map<number, number>();
    for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
      votes.set(seat, targetSeat);
    }
    const resolved = resolveWolfVotes(votes);
    if (typeof resolved === 'number') {
      killedIndex = resolved;
    }
  }

  // 2. 查找女巫座位，用于 notSelf 约束
  // 防御：若 hasWitch=true 但 players 中找不到 witch（中间态），witchSeat=-1
  // 此时 canSave 会因 killedIndex !== witchSeat 而可能为 true，
  // 但由于 killedIndex >= 0 条件限制，只有真正有被杀者时才 canSave=true
  // 且此场景下女巫自己不可能是被杀者（她存在于 templateRoles 但还未分配）
  let witchSeat = -1;
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role === 'witch') {
      witchSeat = Number.parseInt(seatStr, 10);
      break;
    }
  }

  // 3. Schema-first: witchAction.steps[0] (save) 有 notSelf 约束
  // canSave 必须为 false 当：(1) 没有被杀者 或 (2) 被杀者是女巫自己
  const canSave = killedIndex >= 0 && killedIndex !== witchSeat;

  // Night-1 only（项目规则）: 毒药总是可用
  // 若未来支持多夜，需改为从 state 读取女巫是否已用毒
  const canPoison = true;

  return { killedIndex, canSave, canPoison };
}

/**
 * 检查是否需要设置 witchContext，如需要则返回 action
 *
 * 统一入口：任何地方进入 witchAction 步骤时都调用此函数
 *
 * @param nextStepId 即将进入的步骤 ID
 * @param state 当前游戏状态
 * @returns SET_WITCH_CONTEXT action 或 null
 */
export function maybeCreateWitchContextAction(
  nextStepId: SchemaId,
  state: NonNullState,
): SetWitchContextAction | null {
  const hasWitch = state.templateRoles.includes('witch');

  // 只在进入 witchAction 步骤且尚未设置 witchContext 时触发
  if (nextStepId !== 'witchAction' || !hasWitch || state.witchContext) {
    return null;
  }

  return {
    type: 'SET_WITCH_CONTEXT',
    payload: computeWitchContext(state),
  };
}

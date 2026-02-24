/**
 * Confirm Context - 猎人/黑狼王确认上下文计算
 *
 * 纯函数模块，负责：
 * - 在进入 hunterConfirm / darkWolfKingConfirm 步骤前，计算 canShoot
 * - 返回 SET_CONFIRM_STATUS action 或 null
 *
 * 设计原则：
 * - 单一真相：confirmStatus 只存在于 GameState.confirmStatus
 * - 纯函数：不 IO、不读外部、不写 state
 * - 与 witchContext.ts 对称：step-entry context，在步骤开始前就位
 *
 * 可读取 currentNightResults.poisonedSeat 判断是否被毒，不包含 IO（网络 / 音频 / Alert）。
 */

import type { SchemaId } from '../../models/roles/spec';
import type { GameState } from '../../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';

/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<GameState>;

/** hunterConfirm / darkWolfKingConfirm stepId → role 映射 */
const CONFIRM_STEP_ROLE: Record<string, 'hunter' | 'darkWolfKing'> = {
  hunterConfirm: 'hunter',
  darkWolfKingConfirm: 'darkWolfKing',
};

/**
 * 计算 confirmStatus（纯函数）
 *
 * 规则：被女巫毒杀的角色不能发动技能（canShoot = false）。
 * 判定条件：currentNightResults.poisonedSeat === 该角色的座位号。
 *
 * @param role 角色 ID（hunter | darkWolfKing）
 * @param state 当前游戏状态
 * @returns { role, canShoot }
 */
function computeConfirmStatus(
  role: 'hunter' | 'darkWolfKing',
  state: NonNullState,
): { role: 'hunter' | 'darkWolfKing'; canShoot: boolean } {
  // 找到该角色的座位号
  let roleSeat: number | null = null;
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role === role) {
      roleSeat = Number.parseInt(seatStr, 10);
      break;
    }
  }

  // Fail-closed: 如果找不到角色座位，canShoot = false（异常态不应发技能）
  if (roleSeat === null) {
    return { role, canShoot: false };
  }

  const poisonedSeat = state.currentNightResults?.poisonedSeat;
  const canShoot = poisonedSeat !== roleSeat;

  return { role, canShoot };
}

/**
 * 检查是否需要设置 confirmStatus，如需要则返回 action
 *
 * 统一入口：任何地方进入 hunterConfirm / darkWolfKingConfirm 步骤时都调用此函数
 *
 * @param nextStepId 即将进入的步骤 ID
 * @param state 当前游戏状态
 * @returns SET_CONFIRM_STATUS action 或 null
 */
export function maybeCreateConfirmStatusAction(
  nextStepId: SchemaId,
  state: NonNullState,
): SetConfirmStatusAction | null {
  const role = CONFIRM_STEP_ROLE[nextStepId];
  if (!role) {
    return null;
  }

  // 检查模板中是否有该角色
  if (!state.templateRoles.includes(role)) {
    return null;
  }

  return {
    type: 'SET_CONFIRM_STATUS',
    payload: computeConfirmStatus(role, state),
  };
}

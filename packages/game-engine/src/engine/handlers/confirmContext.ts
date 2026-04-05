/**
 * Confirm Context - 猎人/黑狼王/复仇者确认上下文计算
 *
 * 纯函数模块，负责：
 * - 在进入 hunterConfirm / darkWolfKingConfirm 步骤前，计算 canShoot
 * - 在进入 avengerConfirm 步骤前，计算阵营（faction）
 * - 返回 SET_CONFIRM_STATUS action 或 null
 *
 * 设计原则：
 * - 单一真相：confirmStatus 只存在于 GameState.confirmStatus
 * - 纯函数：不 IO、不读外部、不写 state
 * - 与 witchContext.ts 对称：step-entry context，在步骤开始前就位
 *
 * canShoot 判定：仅被狼人袭击或公投放逐出局时可发动。以下夜间死法均不能开枪：
 * - 被女巫/毒师毒杀
 * - 丘比特殉情（搭档夜间死亡）
 * - 摄梦连锁死亡（摄梦人夜间死亡 → 梦游者连带死亡）
 * - 狼美人魅惑连锁（狼美人夜间死亡 → 被魅惑者连带死亡）
 */

import { type SchemaId } from '../../models/roles/spec';
import type { RoleSpec } from '../../models/roles/spec/roleSpec.types';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import { Team } from '../../models/roles/spec/types';
import type { ConfirmStatus } from '../../protocol/types';
import { findSeatByRole } from '../../utils/playerHelpers';
import type { SetConfirmStatusAction } from '../reducer/types';
import type { NonNullState } from './types';

type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger';

/**
 * Derive the confirm-step → role mapping from ROLE_SPECS.
 * Scans for roles with confirm-kind nightSteps.
 */
function deriveConfirmStepRoleMap(): Record<string, ConfirmRole> {
  const map: Record<string, ConfirmRole> = {};
  for (const [roleId, rawSpec] of Object.entries(ROLE_SPECS)) {
    const spec = rawSpec as RoleSpec;
    if (!spec.nightSteps) continue;
    for (const step of spec.nightSteps) {
      if (step.actionKind === 'confirm') {
        map[step.stepId] = roleId as ConfirmRole;
      }
    }
  }
  return map;
}

/** hunterConfirm / darkWolfKingConfirm / avengerConfirm stepId → role 映射 */
const CONFIRM_STEP_ROLE: Record<string, ConfirmRole> = deriveConfirmStepRoleMap();

/**
 * 判断某座位夜间是否可以开枪（仅被狼人袭击或公投放逐出局时可发动）。
 *
 * 夜间非正常死亡（毒杀/殉情/摄梦连锁/魅惑连锁）均不能开枪。
 * 供 confirmContext（猎人/黑狼王）和 actionHandler（wolfRobot 学到猎人）共用。
 */
export function computeCanShootForSeat(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  return (
    results?.poisonedSeat !== seat &&
    !isCoupleDeathVictim(seat, state) &&
    !isDreamLinkedDeath(seat, state) &&
    !isWolfQueenCharmVictim(seat, state)
  );
}

/**
 * 计算 confirmStatus（纯函数）
 *
 * 猎人/黑狼王：仅被狼人袭击或公投放逐出局时可发动。
 * 夜间非正常死亡（毒杀/殉情/摄梦连锁/魅惑连锁）均不能开枪。
 *
 * 复仇者：阵营由 shadow resolver 预计算存入 currentNightResults.avengerFaction，此处直接读取。
 */
function computeConfirmStatus(role: ConfirmRole, state: NonNullState): ConfirmStatus {
  if (role === 'avenger') {
    return computeAvengerConfirmStatus(state);
  }

  // Hunter / DarkWolfKing
  const roleSeat = findSeatByRole(state.players, role);

  // Fail-closed: 如果找不到角色座位，canShoot = false（异常态不应发技能）
  if (roleSeat === null) {
    return { role, canShoot: false };
  }

  return { role, canShoot: computeCanShootForSeat(roleSeat, state) };
}

/**
 * 计算复仇者确认状态
 *
 * avengerFaction 由 shadow resolver 在模仿时直接计算并存入 currentNightResults。
 * 此处仅读取，无需再次推导。未选目标（被封锁/不在模板）→ 兜底好人阵营。
 */
function computeAvengerConfirmStatus(state: NonNullState): ConfirmStatus {
  return {
    role: 'avenger',
    faction: state.currentNightResults?.avengerFaction ?? Team.Good,
  };
}

// =============================================================================
// 夜间非正常死亡判定（canShoot = false 的条件）
// =============================================================================

/**
 * 判断某座位是否会在夜间死亡（被狼刀且未被救/被毒杀）。
 *
 * 仅用于连锁死亡判断的子条件。
 * 在 hunterConfirm / darkWolfKingConfirm 步骤时调用（此时 wolf/witch 已行动）。
 */
function willDieTonight(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;

  // 被毒杀
  if (results?.poisonedSeat === seat) return true;

  // 被狼刀且未被女巫救
  const wolfKillTarget = state.witchContext?.killedSeat;
  if (wolfKillTarget !== undefined && wolfKillTarget >= 0 && wolfKillTarget === seat) {
    if (results?.savedSeat === seat) return false;
    return true;
  }

  return false;
}

/**
 * 判断该座位是否会因情侣殉情而死亡。
 *
 * 检查该座位是否为情侣之一，且搭档是否会在夜间死亡。
 */
function isCoupleDeathVictim(seat: number, state: NonNullState): boolean {
  const loverSeats = state.loverSeats;
  if (!loverSeats || !loverSeats.includes(seat)) return false;

  const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
  return willDieTonight(partnerSeat, state);
}

/**
 * 判断该座位是否会因摄梦连锁而死亡。
 *
 * 条件：该座位是摄梦目标（dreamingSeat）且摄梦人当夜会死亡。
 */
function isDreamLinkedDeath(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  if (results?.dreamingSeat !== seat) return false;

  const dreamcatcherSeat = findSeatByRole(state.players, 'dreamcatcher');
  if (dreamcatcherSeat === null) return false;

  return willDieTonight(dreamcatcherSeat, state);
}

/**
 * 判断该座位是否会因狼美人魅惑连锁而死亡。
 *
 * 条件：该座位是狼美人魅惑目标（charmedSeat）且狼美人当夜会死亡。
 */
function isWolfQueenCharmVictim(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  if (results?.charmedSeat !== seat) return false;

  const wolfQueenSeat = findSeatByRole(state.players, 'wolfQueen');
  if (wolfQueenSeat === null) return false;

  return willDieTonight(wolfQueenSeat, state);
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

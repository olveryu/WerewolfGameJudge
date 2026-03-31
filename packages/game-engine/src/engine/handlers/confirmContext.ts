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
 * 可读取 currentNightResults.poisonedSeat 判断是否被毒，不包含 IO（网络 / 音频 / Alert）。
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
 * 计算 confirmStatus（纯函数）
 *
 * 猎人/黑狼王：被女巫毒杀的角色不能发动技能（canShoot = false）。
 * 复仇者：阵营由 shadow resolver 预计算存入 currentNightResults.avengerFaction，此处直接读取。
 *   影子模仿好人 → 影子变好人阵营 → 复仇者为狼人阵营（faction = Team.Wolf）
 *   影子模仿狼人 → 影子变狼人阵营 → 复仇者为好人阵营（faction = Team.Good）
 *   影子未选人（被梦魇封锁/不在模板中）→ 兜底好人阵营（faction = Team.Good）
 *   影子模仿复仇者 → 绑定，同属第三方阵营（faction = Team.Third）
 *
 * @param role 角色 ID
 * @param state 当前游戏状态
 * @returns ConfirmStatus (discriminated by role)
 */
function computeConfirmStatus(role: ConfirmRole, state: NonNullState): ConfirmStatus {
  if (role === 'avenger') {
    return computeAvengerConfirmStatus(state);
  }

  // Hunter / DarkWolfKing: poisoned → can't shoot
  const roleSeat = findSeatByRole(state.players, role);

  // Fail-closed: 如果找不到角色座位，canShoot = false（异常态不应发技能）
  if (roleSeat === null) {
    return { role, canShoot: false };
  }

  const poisonedSeat = state.currentNightResults?.poisonedSeat;
  // 殉情不能开枪：情侣一方死亡导致另一方殉情时，殉情方不能开枪
  const canShoot = poisonedSeat !== roleSeat && !isCoupleDeathVictim(roleSeat, state);

  return { role, canShoot };
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

/**
 * 判断该座位是否会因情侣殉情而死亡。
 *
 * 检查该座位是否为情侣之一，且搭档是否会被狼人击杀（未获救）或被毒杀。
 * 仅在 hunterConfirm / darkWolfKingConfirm 步骤时调用（此时 wolf/witch 已行动）。
 */
function isCoupleDeathVictim(seat: number, state: NonNullState): boolean {
  const loverSeats = state.loverSeats;
  if (!loverSeats || !loverSeats.includes(seat)) return false;

  const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
  const results = state.currentNightResults;

  // Partner poisoned → will die → 殉情
  if (results?.poisonedSeat === partnerSeat) return true;

  // Partner killed by wolves (witchContext.killedSeat is the resolved wolf kill target, after guard)
  const wolfKillTarget = state.witchContext?.killedSeat;
  if (wolfKillTarget !== undefined && wolfKillTarget >= 0 && wolfKillTarget === partnerSeat) {
    // Witch saved partner → partner survives → no 殉情
    if (results?.savedSeat === partnerSeat) return false;
    return true;
  }

  return false;
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

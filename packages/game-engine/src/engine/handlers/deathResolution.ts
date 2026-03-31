/**
 * Death Resolution - 夜晚结束死亡结算辅助函数
 *
 * 纯函数模块，负责：
 * - 从 state 构建 NightActions（狼杀、守卫、女巫、狼王魅惑等）
 * - 构建 effective role → seat 映射（magician swap 感知）
 * - 构建 RoleSeatMap（deathCalcRole 驱动，供 DeathCalculator 使用）
 * - 构建反伤来源列表（checkSource / poisonSource）
 *
 * 仅被 handleEndNight 消费。不含 IO，不修改 state。
 */

import { type RoleId, type SchemaId } from '../../models';
import type { WitchAction } from '../../models/actions/WitchAction';
import {
  getWitchPoisonTarget,
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '../../models/actions/WitchAction';
import type { RoleSpec } from '../../models/roles/spec/roleSpec.types';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import type { ProtocolAction } from '../../protocol/types';
import { getRoleAfterSwap } from '../../resolvers/types';
import { buildSeatRoleMap } from '../../utils/playerHelpers';
import type { NightActions, ReflectionSource, RoleSeatMap } from '../DeathCalculator';
import { resolveWolfVotes } from '../resolveWolfVotes';
import type { NonNullState } from './types';

/**
 * 从 state.players 构建 RoleSeatMap（magician swap 感知）
 *
 * 统一身份解析：遍历所有 seat，用 getRoleAfterSwap 获取交换后的有效身份，
 * 再反向查找每个关键角色所在的「有效座位」。
 * 这样 DeathCalculator 中灵骑反弹、毒药免疫等规则自动跟着交换后的身份走。
 *
 * Constraint 校验仍使用原始 players map（玩家不知道 swap，操作合法性按已知信息判定）。
 */
export function buildEffectiveRoleSeatMap(state: NonNullState): Map<RoleId, number> {
  const swappedSeats = state.currentNightResults?.swappedSeats;
  const players = buildSeatRoleMap(state.players);

  const effectiveRoleSeatMap = new Map<RoleId, number>();
  for (const [seat] of players) {
    const effectiveRole = getRoleAfterSwap(seat, players, swappedSeats);
    if (effectiveRole) {
      effectiveRoleSeatMap.set(effectiveRole, seat);
    }
  }
  return effectiveRoleSeatMap;
}

/**
 * 从 effectiveRoleSeatMap 构建 RoleSeatMap（deathCalcRole 驱动）
 *
 * 单循环扫描每个角色的 deathCalcRole + immunities + abilities，
 * 替代原先 7 个 roleId 字符串硬编码查找。
 * reflectionSources 由 buildReflectionSources 构建后注入。
 */
export function buildRoleSeatMap(
  effectiveRoleSeatMap: Map<RoleId, number>,
  reflectionSources: readonly ReflectionSource[],
  isBonded: boolean,
  coupleLinkSeats: RoleSeatMap['coupleLinkSeats'],
): RoleSeatMap {
  const poisonImmuneSeats: number[] = [];
  const reflectsDamageSeats: number[] = [];
  const bondedLinkCandidates: number[] = [];
  let wolfQueenLinkSeat = -1;
  let dreamcatcherLinkSeat = -1;
  let guardProtectorSeat = -1;
  let poisonSourceSeat = -1;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = ROLE_SPECS[roleId as keyof typeof ROLE_SPECS] as RoleSpec;

    // Flag-driven seat arrays (unchanged from V2)
    if (spec.immunities?.some((i) => i.kind === 'poison')) {
      poisonImmuneSeats.push(seat);
    }
    if (spec.abilities.some((a) => a.type === 'passive' && a.effect === 'reflectsDamage')) {
      reflectsDamageSeats.push(seat);
    }

    // deathCalcRole-driven fields
    switch (spec.deathCalcRole) {
      case 'wolfQueenLink':
        wolfQueenLinkSeat = seat;
        break;
      case 'dreamcatcherLink':
        dreamcatcherLinkSeat = seat;
        break;
      case 'guardProtector':
        guardProtectorSeat = seat;
        break;
      case 'poisonSource':
        poisonSourceSeat = seat;
        break;
      case 'bondedLink':
        bondedLinkCandidates.push(seat);
        break;
      // 'checkSource' and 'reflectTarget' don't need dedicated fields
    }
  }

  // bondedLinkSeats is only active when isBonded=true AND exactly 2 candidates found
  const bondedLinkSeats: RoleSeatMap['bondedLinkSeats'] =
    isBonded && bondedLinkCandidates.length === 2
      ? [bondedLinkCandidates[0], bondedLinkCandidates[1]]
      : null;

  return {
    wolfQueenLinkSeat,
    dreamcatcherLinkSeat,
    guardProtectorSeat,
    poisonSourceSeat,
    bondedLinkSeats,
    coupleLinkSeats,
    poisonImmuneSeats,
    reflectsDamageSeats,
    reflectionSources,
  };
}

/**
 * 构建反伤来源列表。
 *
 * 扫描 deathCalcRole='checkSource' 的角色：从 spec.nightSteps[0].stepId 找到 schemaId，
 * 再从 ProtocolAction 中取 targetSeat → 生成 { sourceSeat, targetSeat }。
 *
 * 扫描 deathCalcRole='poisonSource'：从 nightActions.witchAction 提取 poisonTarget。
 *
 * nightmare 封锁的来源在此排除（sourceSeat === nightmareBlock → 不生成条目）。
 */
export function buildReflectionSources(
  effectiveRoleSeatMap: Map<RoleId, number>,
  protocolActions: readonly ProtocolAction[],
  nightActions: NightActions,
): readonly ReflectionSource[] {
  const sources: ReflectionSource[] = [];
  const { nightmareBlock } = nightActions;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = ROLE_SPECS[roleId as keyof typeof ROLE_SPECS] as RoleSpec;
    if (!spec.deathCalcRole) continue;

    // Skip nightmare-blocked sources
    if (nightmareBlock !== undefined && nightmareBlock === seat) continue;

    if (spec.deathCalcRole === 'checkSource') {
      // Find schemaId from the role's first nightStep
      const stepId = spec.nightSteps?.[0]?.stepId;
      if (!stepId) continue;
      const action = findActionBySchemaId(protocolActions, stepId as SchemaId);
      if (action?.targetSeat !== undefined) {
        sources.push({ sourceSeat: seat, targetSeat: action.targetSeat });
      }
    } else if (spec.deathCalcRole === 'poisonSource') {
      const poisonTarget = getWitchPoisonTarget(nightActions.witchAction);
      if (poisonTarget !== undefined) {
        sources.push({ sourceSeat: seat, targetSeat: poisonTarget });
      }
    }
  }

  return sources;
}

/**
 * 从 ProtocolAction 列表中按 schemaId 查找 action
 */
function findActionBySchemaId(
  actions: readonly ProtocolAction[],
  schemaId: SchemaId,
): ProtocolAction | undefined {
  return actions.find((a) => a.schemaId === schemaId);
}

/**
 * 从 currentNightResults 还原 WitchAction
 *
 * wire protocol: witch 的 save/poison 结果已经写入 currentNightResults.savedSeat / poisonedSeat
 * 这里直接从 currentNightResults 读取，不再依赖 ProtocolAction.targetSeat
 */
function extractWitchAction(currentNightResults?: {
  savedSeat?: number;
  poisonedSeat?: number;
}): WitchAction | undefined {
  const savedSeat = currentNightResults?.savedSeat;
  const poisonedSeat = currentNightResults?.poisonedSeat;

  // 优先判断 save（因为 save 和 poison 不会同时有效）
  if (savedSeat !== undefined) {
    return makeWitchSave(savedSeat);
  }

  if (poisonedSeat !== undefined) {
    return makeWitchPoison(poisonedSeat);
  }

  // 没有使用技能
  return makeWitchNone();
}

/**
 * Build NightActions from state for death resolution.
 *
 * 数据来源设计：
 * - currentNightResults（resolver 产出）: wolfVotesBySeat, witchAction, swappedSeats
 *   → 这些字段经过 resolver 处理，是最终语义结果（如 witch save/poison 区分）。
 * - ProtocolAction[]（原始提交）: guardProtect, wolfQueenCharm, dreamcatcherDream, nightmareBlock
 *   → 这些字段是简单 chooseSeat 目标，resolver 不做额外转换，targetSeat 即最终值。
 * - 查验类反伤来源（seerCheck 等）不再收集到 NightActions，改由 buildReflectionSources 驱动。
 *
 * 所有座位号均为物理座位（0-based），坐标空间一致。
 */
export function buildNightActions(state: NonNullState): NightActions {
  const actions = state.actions;
  const nightActions: NightActions = {};

  // Wolf kill - resolve final target from wolfVotesBySeat
  // Single source of truth is the votes table; final target is derived.
  if (!state.wolfKillOverride) {
    if (!state.currentNightResults) {
      throw new Error(
        '[FAIL-FAST] buildNightActions: currentNightResults missing in ongoing state',
      );
    }
    const wolfVotesBySeat = state.currentNightResults.wolfVotesBySeat ?? {};
    const votes = new Map<number, number>();
    for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
      votes.set(seat, targetSeat);
    }

    const resolved = resolveWolfVotes(votes, {
      requireUnanimity: state.templateRoles.includes('cupid'),
    });
    if (typeof resolved === 'number') {
      nightActions.wolfKill = resolved;
    }
  }

  // 检查 nightmare 封锁的是否是狼人
  if (state.wolfKillOverride) {
    nightActions.isWolfBlockedByNightmare = true;
  }

  // Guard protect
  const guardAction = findActionBySchemaId(actions, 'guardProtect');
  if (guardAction?.targetSeat !== undefined) {
    nightActions.guardProtect = guardAction.targetSeat;
  }

  // Witch action - 从 currentNightResults.savedSeat / poisonedSeat 读取
  nightActions.witchAction = extractWitchAction(state.currentNightResults);

  // Wolf Queen charm
  const wolfQueenAction = findActionBySchemaId(actions, 'wolfQueenCharm');
  if (wolfQueenAction?.targetSeat !== undefined) {
    nightActions.wolfQueenCharm = wolfQueenAction.targetSeat;
  }

  // Dreamcatcher dream
  const dreamcatcherAction = findActionBySchemaId(actions, 'dreamcatcherDream');
  if (dreamcatcherAction?.targetSeat !== undefined) {
    nightActions.dreamcatcherDream = dreamcatcherAction.targetSeat;
  }

  // Magician swap - 从 currentNightResults.swappedSeats 获取
  if (state.currentNightResults?.swappedSeats) {
    const [first, second] = state.currentNightResults.swappedSeats;
    nightActions.magicianSwap = { first, second };
  }

  // Nightmare block
  const nightmareAction = findActionBySchemaId(actions, 'nightmareBlock');
  if (nightmareAction?.targetSeat !== undefined) {
    nightActions.nightmareBlock = nightmareAction.targetSeat;
  }

  return nightActions;
}

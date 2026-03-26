/**
 * Shadow Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验影子模仿行动 + 计算结果。
 * 直接计算复仇者阵营（avengerFaction）：与影子模仿目标阵营对立。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { ROLE_SPECS, SCHEMAS } from '../models';
import { Team } from '../models/roles/spec/types';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

/** 必须选择模仿目标（canSkip=false） */
const REJECT_MUST_CHOOSE = '必须选择模仿目标' as const;

/** 目标玩家不存在 */
const REJECT_TARGET_NOT_FOUND = '目标玩家不存在' as const;

export const shadowChooseMimicResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Normally must choose someone (canSkip=false)
  // But if blocked by nightmare, skip is allowed
  if (target === undefined || target === null) {
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true, result: {} };
    }
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.shadowChooseMimic;
  if (!('constraints' in schema)) {
    throw new Error('Schema shadowChooseMimic does not have constraints');
  }
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
  }

  // Store mimicry target + compute avenger's faction
  const targetSpec = ROLE_SPECS[targetRoleId];
  const avengerFaction =
    targetRoleId === 'avenger'
      ? Team.Third // bonded: shadow & avenger form third-party
      : targetSpec.team === Team.Wolf
        ? Team.Good // shadow joins wolves → avenger opposes → good
        : Team.Wolf; // shadow joins good/third → avenger opposes → wolf

  return {
    valid: true,
    updates: { shadowMimicTarget: target, avengerFaction },
    result: { idolTarget: target },
  };
};

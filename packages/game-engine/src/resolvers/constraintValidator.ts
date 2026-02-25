/**
 * Constraint Validator (SERVER-ONLY, 纯函数)
 *
 * 职责：根据 schema constraints 统一校验 target 合法性（单一真相），
 * 提供 schema constraint 校验（TargetConstraint.NotSelf / TargetConstraint.NotWolfFaction 等）。resolver 不自行硬编码约束检查（必须调用
 * validateConstraints），不包含 IO（网络 / 音频 / Alert）。
 */

import type { RoleId } from '../models/roles';
import { TargetConstraint } from '../models/roles/spec/schema.types';
import { ROLE_SPECS } from '../models/roles/spec/specs';
import { Team } from '../models/roles/spec/types';

interface ConstraintValidationContext {
  /** Current actor's seat */
  actorSeat: number;
  /** Target seat to validate */
  target: number;
  /** Player seat → roleId map (required for faction-based constraints like notWolfFaction) */
  players?: ReadonlyMap<number, RoleId>;
}

interface ConstraintValidationResult {
  valid: boolean;
  rejectReason?: string;
}

/**
 * Validate a target against a list of constraints.
 *
 * @param constraints - Array of constraint types from schema
 * @param context - Validation context (actorSeat, target, optional players)
 * @returns Validation result with reason if invalid
 */
export function validateConstraints(
  constraints: readonly TargetConstraint[],
  context: ConstraintValidationContext,
): ConstraintValidationResult {
  const { actorSeat, target, players } = context;

  for (const constraint of constraints) {
    switch (constraint) {
      case TargetConstraint.NotSelf:
        if (target === actorSeat) {
          return { valid: false, rejectReason: '不能选择自己' };
        }
        break;
      case TargetConstraint.NotWolfFaction: {
        if (!players) {
          throw new Error(
            '[FAIL-FAST] notWolfFaction constraint requires players map in ConstraintValidationContext',
          );
        }
        const targetRoleId = players.get(target);
        if (targetRoleId && ROLE_SPECS[targetRoleId]?.team === Team.Wolf) {
          return { valid: false, rejectReason: '不能选择狼人阵营的玩家' };
        }
        break;
      }
      default: {
        // Compile-time exhaustiveness guard + runtime fail-fast
        const _exhaustive: never = constraint;
        throw new Error(
          `[FAIL-FAST] Unknown constraint: ${_exhaustive}. Add handler in constraintValidator.ts or remove from schema.`,
        );
      }
    }
  }

  return { valid: true };
}

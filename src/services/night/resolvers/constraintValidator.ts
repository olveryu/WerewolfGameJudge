/**
 * Constraint Validator (HOST-ONLY, 纯函数)
 *
 * 职责：根据 schema constraints 统一校验 target 合法性（单一真相）
 *
 * ✅ 允许：schema constraint 校验（notSelf 等）
 * ❌ 禁止：resolver 自行硬编码约束检查（必须调用 validateConstraints）
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 */

import type { TargetConstraint } from '@/models/roles/spec/schema.types';

export interface ConstraintValidationContext {
  /** Current actor's seat */
  actorSeat: number;
  /** Target seat to validate */
  target: number;
}

export interface ConstraintValidationResult {
  valid: boolean;
  rejectReason?: string;
}

/**
 * Validate a target against a list of constraints.
 *
 * @param constraints - Array of constraint types from schema
 * @param context - Validation context (actorSeat, target)
 * @returns Validation result with reason if invalid
 */
export function validateConstraints(
  constraints: readonly TargetConstraint[],
  context: ConstraintValidationContext,
): ConstraintValidationResult {
  const { actorSeat, target } = context;

  for (const constraint of constraints) {
    switch (constraint) {
      case 'notSelf':
        if (target === actorSeat) {
          return { valid: false, rejectReason: '不能选择自己' };
        }
        break;
      // Future constraints can be added here:
      // case 'notWolf': ...
      // case 'notDead': ...
      default:
        // FAIL-FAST: Unknown constraint must throw error
        throw new Error(
          `[FAIL-FAST] Unknown constraint: ${constraint}. Add handler in constraintValidator.ts or remove from schema.`,
        );
    }
  }

  return { valid: true };
}

/**
 * Constraint Validator
 * 
 * Single source of truth for validating schema constraints in resolvers.
 * Resolvers should call validateConstraints() instead of hard-coding checks.
 */

import type { TargetConstraint } from '../../../models/roles/spec/schema.types';
import { log } from '../../../utils/logger';

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
  context: ConstraintValidationContext
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
        // Unknown constraint - treat as valid (fail-open for forward compat)
        log.extend('Constraint').warn(`Unknown constraint: ${constraint}`);
    }
  }
  
  return { valid: true };
}

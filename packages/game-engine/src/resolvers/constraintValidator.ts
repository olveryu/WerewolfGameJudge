/**
 * Constraint Validator (SERVER-ONLY, 纯函数)
 *
 * 职责：根据 schema constraints 统一校验 target 合法性（单一真相），
 * 提供 schema constraint 校验（TargetConstraint.NotSelf / TargetConstraint.NotWolfFaction 等）。resolver 不自行硬编码约束检查（必须调用
 * validateConstraints），不包含 IO（网络 / 音频 / Alert）。
 */

import { ROLE_SPECS, type RoleId, Team } from '../models';
import { TargetConstraint } from '../models/roles/spec';
import { getRoleAfterSwap } from './types';

interface ConstraintValidationContext {
  /** Current actor's seat */
  actorSeat: number;
  /** Target seat to validate */
  target: number;
  /** Player seat → roleId map (required for faction-based constraints like notWolfFaction) */
  players?: ReadonlyMap<number, RoleId>;
  /** Magician swapped seats (required for swap-aware constraints like AdjacentToWolfFaction) */
  swappedSeats?: readonly [number, number];
  /** Total number of seats (required for adjacency constraints) */
  totalSeats?: number;
  /** True when the target was rewritten by shelter redirect — bypasses NotSelf */
  shelterRedirected?: boolean;
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
  const { actorSeat, target, players, swappedSeats, totalSeats } = context;

  for (const constraint of constraints) {
    switch (constraint) {
      case TargetConstraint.NotSelf:
        if (target === actorSeat && !context.shelterRedirected) {
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
      case TargetConstraint.AdjacentToWolfFaction: {
        if (!players) {
          throw new Error(
            '[FAIL-FAST] AdjacentToWolfFaction constraint requires players map in ConstraintValidationContext',
          );
        }
        if (totalSeats === undefined || totalSeats < 1) {
          throw new Error(
            '[FAIL-FAST] AdjacentToWolfFaction constraint requires totalSeats in ConstraintValidationContext',
          );
        }
        // Find effective wolf-faction seats (swap-aware)
        const wolfSeats: number[] = [];
        for (const [seat] of players) {
          const effectiveRole = getRoleAfterSwap(seat, players, swappedSeats);
          if (effectiveRole && ROLE_SPECS[effectiveRole]?.team === Team.Wolf) {
            wolfSeats.push(seat);
          }
        }
        // Check if target is adjacent (±1 mod totalSeats) to any wolf seat
        const isAdjacent = wolfSeats.some((ws) => {
          const diff = Math.abs(target - ws);
          return diff === 1 || diff === totalSeats - 1;
        });
        if (!isAdjacent) {
          return { valid: false, rejectReason: '只能选择狼人阵营相邻的玩家' };
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

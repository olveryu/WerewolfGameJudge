/**
 * Witch Resolver (HOST-ONLY)
 * 
 * Validates witch action (save/poison compound) and computes result.
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import type { ResolverFn, ResolverResult } from './types';

function validateSaveAction(
  saveTarget: number,
  actorSeat: number,
  wolfKillTarget: number | undefined,
  hasAntidote: boolean,
): string | null {
  if (!hasAntidote) {
    return '解药已用完';
  }
  
  const witchSpec = ROLE_SPECS.witch;
  if (witchSpec.flags?.canSaveSelf === false && saveTarget === actorSeat) {
    return '女巫不能自救';
  }
  
  if (saveTarget !== wolfKillTarget) {
    return '只能救被狼人袭击的玩家';
  }
  
  return null;
}

function validatePoisonAction(
  hasPoison: boolean,
  hasSaveTarget: boolean,
): string | null {
  if (!hasPoison) {
    return '毒药已用完';
  }
  
  if (hasSaveTarget) {
    return '同一晚不能同时使用解药和毒药';
  }
  
  return null;
}

export const witchActionResolver: ResolverFn = (context, input): ResolverResult => {
  const { actorSeat, gameState, currentNightResults } = context;
  const stepResults = input.stepResults;
  
  if (!stepResults) {
    return { valid: false, rejectReason: '缺少行动数据' };
  }
  
  const saveTarget = stepResults.save ?? null;
  const poisonTarget = stepResults.poison ?? null;
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  // Validate save action
  if (saveTarget !== null) {
    const error = validateSaveAction(
      saveTarget,
      actorSeat,
      currentNightResults.wolfKillTarget,
      gameState?.witchHasAntidote ?? true,
    );
    if (error) {
      return { valid: false, rejectReason: error };
    }
  }
  
  // Validate poison action
  if (poisonTarget !== null) {
    const error = validatePoisonAction(
      gameState?.witchHasPoison ?? true,
      saveTarget !== null,
    );
    if (error) {
      return { valid: false, rejectReason: error };
    }
  }
  
  return {
    valid: true,
    updates: {
      savedSeat: saveTarget ?? undefined,
      poisonedSeat: poisonTarget ?? undefined,
    },
    result: {
      savedTarget: saveTarget ?? undefined,
      poisonedTarget: poisonTarget ?? undefined,
    },
  };
};

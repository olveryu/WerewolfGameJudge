/**
 * Witch Resolver (SERVER-ONLY, pure function)
 *
 * Validates the witch's compound action (save/poison) and computes results.
 * Provides save/poison compound action validation and result calculation. No IO (network / audio / Alert).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { resolveWolfVotes } from '../resolveWolfVotes';
import type { ResolverFn, ResolverResult } from './types';

function resolveWolfKillSeatFromVotes(
  wolfVotesBySeat: Readonly<Record<string, number>> | undefined,
): number | undefined {
  if (!wolfVotesBySeat) return undefined;
  const votes = new Map<number, number>();
  for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
    votes.set(seat, targetSeat);
  }
  const resolved = resolveWolfVotes(votes);
  return typeof resolved === 'number' ? resolved : undefined;
}

function validateSaveAction(
  saveTarget: number,
  actorSeat: number,
  wolfKillSeat: number | undefined,
  canSave: boolean,
  witchCanSelfHeal: boolean,
): string | null {
  if (!canSave) {
    return '解药已用完';
  }

  // Night-1-only: witch cannot save herself (unless house rule overrides)
  // Aligned with schema.witchAction.save.constraints=['notSelf']
  if (saveTarget === actorSeat && !witchCanSelfHeal) {
    return '女巫不能自救';
  }

  if (saveTarget !== wolfKillSeat) {
    return '只能救被狼人袭击的玩家';
  }

  return null;
}

function validatePoisonAction(canPoison: boolean, hasSaveTarget: boolean): string | null {
  if (!canPoison) {
    return '毒药已用完';
  }

  if (hasSaveTarget) {
    return '同一晚不能同时使用解药和毒药';
  }

  return null;
}

export const witchActionResolver: ResolverFn = (context, input): ResolverResult => {
  const { actorSeat, witchState, currentNightResults } = context;

  // FAIL-FAST: witch resolver requires witchState sub-context
  if (!witchState) {
    throw new Error('[FAIL-FAST] witch resolver requires witchState in ResolverContext');
  }

  const stepResults = input.stepResults;

  // When stepResults is undefined, treat as "skip" (no ability used)
  // Corresponds to the UI "skip ability" button
  const saveTarget = stepResults?.save ?? null;
  const poisonTarget = stepResults?.poison ?? null;

  // Skip (no action) is always allowed
  if (saveTarget === null && poisonTarget === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate save action
  if (saveTarget !== null) {
    const wolfKillSeat = resolveWolfKillSeatFromVotes(currentNightResults.wolfVotesBySeat);
    const witchCanSelfHeal = context.gameState.witchCanSelfHeal ?? false;
    const error = validateSaveAction(
      saveTarget,
      actorSeat,
      wolfKillSeat,
      witchState.canSave,
      witchCanSelfHeal,
    );
    if (error) {
      return { valid: false, rejectReason: error };
    }
  }

  // Validate poison action
  if (poisonTarget !== null) {
    const error = validatePoisonAction(witchState.canPoison, saveTarget !== null);
    if (error) {
      return { valid: false, rejectReason: error };
    }

    // Poison target must exist
    if (!context.players.has(poisonTarget)) {
      return { valid: false, rejectReason: '目标玩家不存在' };
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

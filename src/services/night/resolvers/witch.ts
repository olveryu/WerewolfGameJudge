/**
 * Witch Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验女巫行动（save/poison compound）+ 计算结果
 *
 * ✅ 允许：救人/毒人复合行动校验 + 结果计算
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { resolveWolfVotes } from '@/services/engine/resolveWolfVotes';

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
  hasAntidote: boolean,
): string | null {
  if (!hasAntidote) {
    return '解药已用完';
  }

  // Night-1-only: 女巫不能自救
  // 此规则与 schema.witchAction.save.constraints=['notSelf'] 对齐
  if (saveTarget === actorSeat) {
    return '女巫不能自救';
  }

  if (saveTarget !== wolfKillSeat) {
    return '只能救被狼人袭击的玩家';
  }

  return null;
}

function validatePoisonAction(hasPoison: boolean, hasSaveTarget: boolean): string | null {
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

  // stepResults 为 undefined 时，视为"不使用技能"（跳过）
  // 这对应 UI 点击"不使用技能"按钮的场景
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
    const error = validateSaveAction(
      saveTarget,
      actorSeat,
      wolfKillSeat,
      gameState?.witchHasAntidote ?? true,
    );
    if (error) {
      return { valid: false, rejectReason: error };
    }
  }

  // Validate poison action
  if (poisonTarget !== null) {
    const error = validatePoisonAction(gameState?.witchHasPoison ?? true, saveTarget !== null);
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

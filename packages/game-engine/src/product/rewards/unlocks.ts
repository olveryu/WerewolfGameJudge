/**
 * Collection unlock queries.
 *
 * Data from `catalog.ts` (single authoritative ID registry).
 * This module provides unlocked set queries and free-item checks.
 * Pure functions, shared by client and server.
 */

import {
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  FREE_SEAT_ANIMATION_IDS,
  getRewardItem,
  REWARD_POOL_BY_ID,
  type RewardItem,
  type RewardType,
} from './catalog';

function getPersistedReward(id: string): RewardItem {
  const reward = REWARD_POOL_BY_ID.get(id);
  if (reward === undefined) {
    throw new Error(`[FAIL-FAST] Persisted unlock ID is not in the reward pool: ${id}`);
  }
  return reward;
}

function assertRewardType(id: string, expectedType: RewardType): void {
  const reward = getRewardItem(id);
  if (reward.type !== expectedType) {
    throw new Error(
      `[FAIL-FAST] Reward item ${id} has type ${reward.type}; expected ${expectedType}`,
    );
  }
}

function getUnlockedItemsByType(
  unlockedIds: readonly string[],
  freeIds: ReadonlySet<string>,
  rewardType: RewardType,
): ReadonlySet<string> {
  const result = new Set(freeIds);
  for (const id of unlockedIds) {
    const reward = getPersistedReward(id);
    if (reward.type === rewardType) result.add(id);
  }
  return result;
}

/** Parse persisted unlocked-item JSON and enforce the reward-catalog contract. */
export function parseUnlockedRewardIds(serialized: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new Error('[FAIL-FAST] Unlocked reward IDs must be valid JSON', { cause });
  }
  if (!Array.isArray(parsed)) {
    throw new Error('[FAIL-FAST] Unlocked reward IDs must be a JSON array');
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of parsed.entries()) {
    if (typeof value !== 'string') {
      throw new Error(`[FAIL-FAST] Unlocked reward ID at index ${index} must be a string`);
    }
    getPersistedReward(value);
    if (seen.has(value)) {
      throw new Error(`[FAIL-FAST] Duplicate unlocked reward item ID: ${value}`);
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

/** Set of unlocked avatar ids (free + player-unlocked avatar type) */
export function getUnlockedAvatars(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_AVATAR_IDS, 'avatar');
}

/** Set of unlocked frame ids (free + player-unlocked frame type) */
export function getUnlockedFrames(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_FRAME_IDS, 'frame');
}

/** Whether the avatar frame is unlocked */
export function isFrameUnlocked(frameId: string, unlockedIds: readonly string[]): boolean {
  assertRewardType(frameId, 'frame');
  return getUnlockedFrames(unlockedIds).has(frameId);
}

/** Set of unlocked seat flair ids (free + player-unlocked seatFlair type) */
export function getUnlockedFlairs(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_FLAIR_IDS, 'seatFlair');
}

/** Whether the seat flair is unlocked */
export function isFlairUnlocked(flairId: string, unlockedIds: readonly string[]): boolean {
  assertRewardType(flairId, 'seatFlair');
  return getUnlockedFlairs(unlockedIds).has(flairId);
}

/** Set of unlocked name style ids (free + player-unlocked nameStyle type) */
export function getUnlockedNameStyles(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_NAME_STYLE_IDS, 'nameStyle');
}

/** Whether the name style is unlocked */
export function isNameStyleUnlocked(nameStyleId: string, unlockedIds: readonly string[]): boolean {
  assertRewardType(nameStyleId, 'nameStyle');
  return getUnlockedNameStyles(unlockedIds).has(nameStyleId);
}

/** Set of unlocked role reveal effect ids (free + player-unlocked roleRevealEffect type) */
export function getUnlockedRoleRevealEffects(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_ROLE_REVEAL_EFFECT_IDS, 'roleRevealEffect');
}

/** Whether the role reveal effect is unlocked */
export function isRoleRevealEffectUnlocked(
  effectId: string,
  unlockedIds: readonly string[],
): boolean {
  assertRewardType(effectId, 'roleRevealEffect');
  return getUnlockedRoleRevealEffects(unlockedIds).has(effectId);
}

/** Set of unlocked seat animation ids (free + player-unlocked seatAnimation type) */
export function getUnlockedSeatAnimations(unlockedIds: readonly string[]): ReadonlySet<string> {
  return getUnlockedItemsByType(unlockedIds, FREE_SEAT_ANIMATION_IDS, 'seatAnimation');
}

/** Whether the seat animation is unlocked */
export function isSeatAnimationUnlocked(
  animationId: string,
  unlockedIds: readonly string[],
): boolean {
  assertRewardType(animationId, 'seatAnimation');
  return getUnlockedSeatAnimations(unlockedIds).has(animationId);
}

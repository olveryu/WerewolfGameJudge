/**
 * frameUnlock — unlock queries and random draws
 *
 * Data from `rewardCatalog.ts` (single authoritative ID registry).
 * This module provides: unlocked set queries, random draws, free-item checks.
 * Pure functions, shared by client and server.
 */

import {
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  FREE_SEAT_ANIMATION_IDS,
  REWARD_POOL,
  REWARD_POOL_BY_ID,
  type RewardItem,
  type RewardType,
} from './rewardCatalog';

/**
 * Randomly draw a reward from the not-yet-unlocked pool.
 *
 * Rules: every 5 levels prefers frame, every 3 levels prefers seat flair, every 7 levels prefers name style; other levels prefer avatar.
 * If the target type pool is empty, fall back to any unlocked item.
 *
 * @param unlockedIds - set of ids the player has unlocked (including free items)
 * @param randomFn - random function returning an integer in [0, max) (server uses crypto)
 * @param level - the level just reached (determines draw type)
 * @returns the drawn reward, or undefined if the pool is empty
 */
export function pickRandomReward(
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
  level: number,
): RewardItem | undefined {
  const preferredType: RewardType =
    level % 5 === 0
      ? 'frame'
      : level % 7 === 0
        ? 'nameStyle'
        : level % 11 === 0
          ? 'roleRevealEffect'
          : level % 13 === 0
            ? 'seatAnimation'
            : level % 3 === 0
              ? 'seatFlair'
              : 'avatar';
  const preferred = REWARD_POOL.filter(
    (item) => item.type === preferredType && !unlockedIds.has(item.id),
  );
  if (preferred.length > 0) return preferred[randomFn(preferred.length)];

  // Fallback: target type exhausted, draw from any unlocked item
  const fallback = REWARD_POOL.filter((item) => !unlockedIds.has(item.id));
  if (fallback.length === 0) return undefined;
  return fallback[randomFn(fallback.length)];
}

/** Set of unlocked avatar ids (free + player-unlocked avatar type) */
export function getUnlockedAvatars(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_AVATAR_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'avatar') set.add(id);
  }
  return set;
}

/** Set of unlocked frame ids (free + player-unlocked frame type) */
export function getUnlockedFrames(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_FRAME_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'frame') set.add(id);
  }
  return set;
}

/** Whether the avatar frame is unlocked */
export function isFrameUnlocked(frameId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedFrames(unlockedIds).has(frameId);
}

/** Set of unlocked seat flair ids (free + player-unlocked seatFlair type) */
export function getUnlockedFlairs(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_FLAIR_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'seatFlair') set.add(id);
  }
  return set;
}

/** Whether the seat flair is unlocked */
export function isFlairUnlocked(flairId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedFlairs(unlockedIds).has(flairId);
}

/** Set of unlocked name style ids (free + player-unlocked nameStyle type) */
export function getUnlockedNameStyles(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_NAME_STYLE_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'nameStyle') set.add(id);
  }
  return set;
}

/** Whether the name style is unlocked */
export function isNameStyleUnlocked(nameStyleId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedNameStyles(unlockedIds).has(nameStyleId);
}

/** Set of unlocked role reveal effect ids (free + player-unlocked roleRevealEffect type) */
export function getUnlockedRoleRevealEffects(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_ROLE_REVEAL_EFFECT_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'roleRevealEffect') set.add(id);
  }
  return set;
}

/** Whether the role reveal effect is unlocked */
export function isRoleRevealEffectUnlocked(
  effectId: string,
  unlockedIds: readonly string[],
): boolean {
  return getUnlockedRoleRevealEffects(unlockedIds).has(effectId);
}

/** Set of unlocked seat animation ids (free + player-unlocked seatAnimation type) */
export function getUnlockedSeatAnimations(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_SEAT_ANIMATION_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'seatAnimation') set.add(id);
  }
  return set;
}

/** Whether the seat animation is unlocked */
export function isSeatAnimationUnlocked(
  animationId: string,
  unlockedIds: readonly string[],
): boolean {
  return getUnlockedSeatAnimations(unlockedIds).has(animationId);
}

/**
 * avatar - Local avatar image registry and selection utilities
 *
 * 43 dark fantasy role portraits from assets/avatars/raw/.
 * 提供头像图片映射、基于 userId/roomId 的稳定 hash 分配和去重。
 * 不引入 React、service，也不发起网络请求。
 *
 * ID 注册表来自 `@werewolf/game-engine/growth/rewardCatalog`（唯一权威来源）。
 * 新增头像需同时更新 rewardCatalog AVATAR_IDS 和 avatarImages.ts / avatarImages.web.ts。
 *
 * Image maps are split by platform (Metro resolves .web.ts automatically):
 * - avatarImages.ts — native: 2048px raw PNGs + 512px badge PNGs
 * - avatarImages.web.ts — web: 512px WebP avatars + 128px WebP badges
 */

import { AVATAR_IDS, type AvatarId } from '@werewolf/game-engine/growth/rewardCatalog';

import { AVATAR_IMAGE_MAP, AVATAR_THUMB_MAP } from './avatarImages';

/** Prefix for builtin avatar URLs stored in user_metadata.avatar_url */
export const BUILTIN_AVATAR_PREFIX = 'builtin://';

/**
 * Role name keys in stable sorted order (from shared catalog).
 * Each key matches the filename (without extension) in assets/avatars/raw/.
 */
export const AVATAR_KEYS: readonly AvatarId[] = AVATAR_IDS;

/** All local avatar image sources, in AVATAR_IDS order. */
export const AVATAR_IMAGES: readonly number[] = AVATAR_IDS.map((id) => AVATAR_IMAGE_MAP[id]);

/** All local avatar thumbnails, in AVATAR_IDS order. */
const AVATAR_THUMBS: readonly number[] = AVATAR_IDS.map((id) => AVATAR_THUMB_MAP[id]);

/**
 * Get 512px thumbnail image source by index (for grids / preview strips).
 * @param index - 0-based avatar index
 */
export function getAvatarThumbByIndex(index: number): number {
  const safeIndex = Math.abs(index) % AVATAR_THUMBS.length;
  return AVATAR_THUMBS[safeIndex];
}

/** Derive role name key (e.g. "seer") from 0-based index. */
function avatarKeyForIndex(index: number): string {
  return AVATAR_KEYS[index];
}

/**
 * FNV-1a hash — better avalanche properties than djb2 for short similar strings.
 * Returns an unsigned 32-bit integer.
 */
function fnv1aHash(str: string): number {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.codePointAt(i) || 0;
    hash = Math.imul(hash, 16777619); // FNV prime (32-bit)
  }
  return hash >>> 0;
}

/**
 * Get a stable default avatar for a user in a specific room.
 *
 * Properties:
 * - Deterministic: same (roomId, userId) always returns the same avatar index
 * - Seat-independent: changing seats does NOT change avatar
 * - Room-specific: same userId in different rooms may get different avatars
 * - Minimizes collisions: uses userId hash as primary index with room offset
 *
 * @param roomId - The room identifier
 * @param userId - The user's unique identifier
 * @returns The avatar index (0-based) - use getAvatarImageByIndex to get the actual image
 */
function getDefaultAvatarIndex(roomId: string, userId: string): number {
  // Combine roomId and userId into a single string before hashing.
  // FNV-1a has much better avalanche than djb2 for short sequential strings
  // like "bot-0" .. "bot-11", greatly reducing collisions within a room.
  const combined = `${roomId}:${userId}`;
  return fnv1aHash(combined) % AVATAR_IMAGES.length;
}

/**
 * Assign guaranteed-unique avatar indices to a list of UIDs within one room.
 *
 * Uses each userId's preferred index (from getDefaultAvatarIndex) as the starting
 * point, then probes forward to find the next free slot if taken.
 * With 61 avatars and ≤12 players this always succeeds and never collides.
 *
 * @param roomId - The room identifier
 * @param uids   - Ordered list of player UIDs in the room
 * @returns Map from userId → unique avatar index (0-based)
 */
export function getUniqueAvatarMap(roomId: string, uids: string[]): Map<string, number> {
  const N = AVATAR_IMAGES.length;
  const taken = new Set<number>();
  const result = new Map<string, number>();

  for (const userId of uids) {
    let idx = getDefaultAvatarIndex(roomId, userId);
    // Linear probe until we find a free slot
    while (taken.has(idx)) {
      idx = (idx + 1) % N;
    }
    taken.add(idx);
    result.set(userId, idx);
  }

  return result;
}

/**
 * Get avatar image source by index.
 * @param index - 0-based avatar index
 * @returns The avatar image source (require() result)
 */
export function getAvatarImageByIndex(index: number): number {
  const safeIndex = Math.abs(index) % AVATAR_IMAGES.length;
  return AVATAR_IMAGES[safeIndex];
}

/** Check whether an avatarUrl is a builtin avatar reference (e.g. "builtin://seer") */
export function isBuiltinAvatarUrl(url: string): boolean {
  return url.startsWith(BUILTIN_AVATAR_PREFIX);
}

/** Resolve a builtin:// URL to the local image source (require() result). */
export function getBuiltinAvatarImage(url: string): number {
  const key = url.slice(BUILTIN_AVATAR_PREFIX.length); // e.g. "seer"
  const index = (AVATAR_KEYS as readonly string[]).indexOf(key);
  if (index === -1) return AVATAR_IMAGES[0];
  return AVATAR_IMAGES[index];
}

/** Create a builtin:// URL for the avatar at the given 0-based index. */
export function makeBuiltinAvatarUrl(index: number): string {
  const safeIndex = Math.abs(index) % AVATAR_IMAGES.length;
  return `${BUILTIN_AVATAR_PREFIX}${avatarKeyForIndex(safeIndex)}`;
}

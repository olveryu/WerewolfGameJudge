/**
 * avatar - Local avatar image registry and selection utilities
 *
 * Dark fantasy style character portraits, auto-discovered from assets/avatars/.
 * 提供头像图片映射、基于 uid/roomId 的稳定 hash 分配和去重。
 * 不引入 React、service，也不发起网络请求。
 *
 * 新增头像只需将 villager_NNN.jpg/.png 放入 assets/avatars/，无需修改本文件。
 */

/** Prefix for builtin avatar URLs stored in user_metadata.avatar_url */
export const BUILTIN_AVATAR_PREFIX = 'builtin://';

// Auto-discover all villager avatar images via Metro's require.context.
// keys() returns sorted paths like ['./villager_001.jpg', ...], ensuring stable order.
const avatarContext = require.context(
  '../../assets/avatars',
  false,
  /^\.\/villager_\d+\.(jpg|png)$/,
);
const avatarKeys = avatarContext.keys().sort();
const AVATAR_IMAGES: number[] = avatarKeys.map((key) => avatarContext<number>(key));

/** All local avatar image sources, in stable sorted order. */
export { AVATAR_IMAGES };

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
 * Simple deterministic hash function (djb2 algorithm)
 * Returns a non-negative integer.
 * Kept for backward-compat with getAvatarImage (seed-based).
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) || 0;
    hash = ((hash << 5) + hash) ^ char; // hash * 33 ^ char
  }
  return Math.abs(hash);
}

/**
 * Get a random avatar image based on seed
 * Returns a local image source (for use with Image component)
 */
export const getAvatarImage = (seed: string): number => {
  const index = djb2Hash(seed) % AVATAR_IMAGES.length;
  return AVATAR_IMAGES[index];
};

/**
 * Get a stable default avatar for a user in a specific room.
 *
 * Properties:
 * - Deterministic: same (roomId, uid) always returns the same avatar index
 * - Seat-independent: changing seats does NOT change avatar
 * - Room-specific: same uid in different rooms may get different avatars
 * - Minimizes collisions: uses uid hash as primary index with room offset
 *
 * @param roomId - The room identifier
 * @param uid - The user's unique identifier
 * @returns The avatar index (0-based) - use getAvatarImageByIndex to get the actual image
 */
function getDefaultAvatarIndex(roomId: string, uid: string): number {
  // Combine roomId and uid into a single string before hashing.
  // FNV-1a has much better avalanche than djb2 for short sequential strings
  // like "bot-0" .. "bot-11", greatly reducing collisions within a room.
  const combined = `${roomId}:${uid}`;
  return fnv1aHash(combined) % AVATAR_IMAGES.length;
}

/**
 * Assign guaranteed-unique avatar indices to a list of UIDs within one room.
 *
 * Uses each uid's preferred index (from getDefaultAvatarIndex) as the starting
 * point, then probes forward to find the next free slot if taken.
 * With 61 avatars and ≤12 players this always succeeds and never collides.
 *
 * @param roomId - The room identifier
 * @param uids   - Ordered list of player UIDs in the room
 * @returns Map from uid → unique avatar index (0-based)
 */
export function getUniqueAvatarMap(roomId: string, uids: string[]): Map<string, number> {
  const N = AVATAR_IMAGES.length;
  const taken = new Set<number>();
  const result = new Map<string, number>();

  for (const uid of uids) {
    let idx = getDefaultAvatarIndex(roomId, uid);
    // Linear probe until we find a free slot
    while (taken.has(idx)) {
      idx = (idx + 1) % N;
    }
    taken.add(idx);
    result.set(uid, idx);
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

/**
 * Get a stable default avatar image for a user in a specific room.
 * Convenience function that combines getDefaultAvatarIndex and getAvatarImageByIndex.
 *
 * @param roomId - The room identifier
 * @param uid - The user's unique identifier
 * @returns The avatar image source
 */
export function getAvatarByUid(roomId: string, uid: string): number {
  const index = getDefaultAvatarIndex(roomId, uid);
  return getAvatarImageByIndex(index);
}

/** Check whether an avatarUrl is a builtin avatar reference (e.g. "builtin://villager_042") */
export function isBuiltinAvatarUrl(url: string): boolean {
  return url.startsWith(BUILTIN_AVATAR_PREFIX);
}

/** Resolve a builtin:// URL to the local image source (require() result). */
export function getBuiltinAvatarImage(url: string): number {
  const filename = url.slice(BUILTIN_AVATAR_PREFIX.length);
  const key = `./${filename}.jpg`;
  const keyPng = `./${filename}.png`;
  const matchIndex =
    avatarKeys.indexOf(key) !== -1 ? avatarKeys.indexOf(key) : avatarKeys.indexOf(keyPng);
  if (matchIndex === -1) return AVATAR_IMAGES[0];
  return AVATAR_IMAGES[matchIndex];
}

/** Create a builtin:// URL for the avatar at the given 0-based index. */
export function makeBuiltinAvatarUrl(index: number): string {
  const safeIndex = Math.abs(index) % AVATAR_IMAGES.length;
  // Extract filename like "villager_042" from the key "./villager_042.jpg"
  const key = avatarKeys[safeIndex];
  const name = key.replace(/^\.\//, '').replace(/\.(jpg|png)$/, '');
  return `${BUILTIN_AVATAR_PREFIX}${name}`;
}

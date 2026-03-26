/**
 * avatar - Local avatar image registry and selection utilities
 *
 * 34 dark fantasy role portraits from assets/avatars/raw/.
 * 提供头像图片映射、基于 uid/roomId 的稳定 hash 分配和去重。
 * 不引入 React、service，也不发起网络请求。
 *
 * 新增头像需同时在 AVATAR_KEYS 和 AVATAR_IMAGES 末尾追加对应条目。
 */

/** Prefix for builtin avatar URLs stored in user_metadata.avatar_url */
export const BUILTIN_AVATAR_PREFIX = 'builtin://';

/**
 * Role name keys in stable sorted order.
 * Each key matches the filename (without extension) in assets/avatars/raw/.
 * Exported so consumers (e.g. SettingsScreen) can resolve builtin:// URLs back to indices.
 */
// prettier-ignore
export const AVATAR_KEYS: readonly string[] = [
  'avenger',
  'awakenedGargoyle',
  'bloodMoon',
  'dancer',
  'darkWolfKing',
  'dreamcatcher',
  'drunkSeer',
  'gargoyle',
  'graveyardKeeper',
  'guard',
  'hunter',
  'idiot',
  'knight',
  'magician',
  'masquerade',
  'mirrorSeer',
  'nightmare',
  'piper',
  'psychic',
  'pureWhite',
  'seer',
  'shadow',
  'silenceElder',
  'slacker',
  'spiritKnight',
  'villager',
  'votebanElder',
  'warden',
  'wildChild',
  'witch',
  'witcher',
  'wolf',
  'wolfKing',
  'wolfQueen',
  'wolfRobot',
  'wolfWitch',
];

// Static require list — keep in same order as AVATAR_KEYS.
// prettier-ignore
const AVATAR_IMAGES: number[] = [
  require('../../assets/avatars/raw/avenger.png'),
  require('../../assets/avatars/raw/awakenedGargoyle.png'),
  require('../../assets/avatars/raw/bloodMoon.png'),
  require('../../assets/avatars/raw/dancer.png'),
  require('../../assets/avatars/raw/darkWolfKing.png'),
  require('../../assets/avatars/raw/dreamcatcher.png'),
  require('../../assets/avatars/raw/drunkSeer.png'),
  require('../../assets/avatars/raw/gargoyle.png'),
  require('../../assets/avatars/raw/graveyardKeeper.png'),
  require('../../assets/avatars/raw/guard.png'),
  require('../../assets/avatars/raw/hunter.png'),
  require('../../assets/avatars/raw/idiot.png'),
  require('../../assets/avatars/raw/knight.png'),
  require('../../assets/avatars/raw/magician.png'),
  require('../../assets/avatars/raw/masquerade.png'),
  require('../../assets/avatars/raw/mirrorSeer.png'),
  require('../../assets/avatars/raw/nightmare.png'),
  require('../../assets/avatars/raw/piper.png'),
  require('../../assets/avatars/raw/psychic.png'),
  require('../../assets/avatars/raw/pureWhite.png'),
  require('../../assets/avatars/raw/seer.png'),
  require('../../assets/avatars/raw/shadow.png'),
  require('../../assets/avatars/raw/silenceElder.png'),
  require('../../assets/avatars/raw/slacker.png'),
  require('../../assets/avatars/raw/spiritKnight.png'),
  require('../../assets/avatars/raw/villager.png'),
  require('../../assets/avatars/raw/votebanElder.png'),
  require('../../assets/avatars/raw/warden.png'),
  require('../../assets/avatars/raw/wildChild.png'),
  require('../../assets/avatars/raw/witch.png'),
  require('../../assets/avatars/raw/witcher.png'),
  require('../../assets/avatars/raw/wolf.png'),
  require('../../assets/avatars/raw/wolfKing.png'),
  require('../../assets/avatars/raw/wolfQueen.png'),
  require('../../assets/avatars/raw/wolfRobot.png'),
  require('../../assets/avatars/raw/wolfWitch.png'),
];

/** All local avatar image sources, in stable sorted order. */
export { AVATAR_IMAGES };

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

/** Check whether an avatarUrl is a builtin avatar reference (e.g. "builtin://seer") */
export function isBuiltinAvatarUrl(url: string): boolean {
  return url.startsWith(BUILTIN_AVATAR_PREFIX);
}

/** Resolve a builtin:// URL to the local image source (require() result). */
export function getBuiltinAvatarImage(url: string): number {
  const key = url.slice(BUILTIN_AVATAR_PREFIX.length); // e.g. "seer"
  const index = AVATAR_KEYS.indexOf(key);
  if (index === -1) return AVATAR_IMAGES[0];
  return AVATAR_IMAGES[index];
}

/** Create a builtin:// URL for the avatar at the given 0-based index. */
export function makeBuiltinAvatarUrl(index: number): string {
  const safeIndex = Math.abs(index) % AVATAR_IMAGES.length;
  return `${BUILTIN_AVATAR_PREFIX}${avatarKeyForIndex(safeIndex)}`;
}

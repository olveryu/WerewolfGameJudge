/**
 * avatar - Local avatar image registry and selection utilities
 *
 * 43 dark fantasy role portraits from assets/avatars/raw/.
 * 提供头像图片映射、基于 uid/roomId 的稳定 hash 分配和去重。
 * 不引入 React、service，也不发起网络请求。
 *
 * ID 注册表来自 `@werewolf/game-engine/growth/rewardCatalog`（唯一权威来源）。
 * 新增头像需同时更新 rewardCatalog AVATAR_IDS 和此文件的 AVATAR_IMAGES / AVATAR_THUMBS。
 */

import { AVATAR_IDS, type AvatarId } from '@werewolf/game-engine/growth/rewardCatalog';

/** Prefix for builtin avatar URLs stored in user_metadata.avatar_url */
export const BUILTIN_AVATAR_PREFIX = 'builtin://';

/**
 * Role name keys in stable sorted order (from shared catalog).
 * Each key matches the filename (without extension) in assets/avatars/raw/.
 */
export const AVATAR_KEYS: readonly AvatarId[] = AVATAR_IDS;

/**
 * Avatar image registry (exhaustive Record) — AVATAR_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * 2048px raw portraits from assets/avatars/raw/.
 */
// prettier-ignore
const AVATAR_IMAGE_MAP: Record<AvatarId, number> = {
  avenger: require('../../assets/avatars/raw/avenger.png'),
  awakenedGargoyle: require('../../assets/avatars/raw/awakenedGargoyle.png'),
  bloodMoon: require('../../assets/avatars/raw/bloodMoon.png'),
  crow: require('../../assets/avatars/raw/crow.png'),
  cursedFox: require('../../assets/avatars/raw/cursedFox.png'),
  cupid: require('../../assets/avatars/raw/cupid.png'),
  dancer: require('../../assets/avatars/raw/dancer.png'),
  darkWolfKing: require('../../assets/avatars/raw/darkWolfKing.png'),
  dreamcatcher: require('../../assets/avatars/raw/dreamcatcher.png'),
  drunkSeer: require('../../assets/avatars/raw/drunkSeer.png'),
  gargoyle: require('../../assets/avatars/raw/gargoyle.png'),
  graveyardKeeper: require('../../assets/avatars/raw/graveyardKeeper.png'),
  guard: require('../../assets/avatars/raw/guard.png'),
  hunter: require('../../assets/avatars/raw/hunter.png'),
  idiot: require('../../assets/avatars/raw/idiot.png'),
  knight: require('../../assets/avatars/raw/knight.png'),
  magician: require('../../assets/avatars/raw/magician.png'),
  maskedMan: require('../../assets/avatars/raw/maskedMan.png'),
  masquerade: require('../../assets/avatars/raw/masquerade.png'),
  mirrorSeer: require('../../assets/avatars/raw/mirrorSeer.png'),
  nightmare: require('../../assets/avatars/raw/nightmare.png'),
  piper: require('../../assets/avatars/raw/piper.png'),
  poisoner: require('../../assets/avatars/raw/poisoner.png'),
  psychic: require('../../assets/avatars/raw/psychic.png'),
  pureWhite: require('../../assets/avatars/raw/pureWhite.png'),
  seer: require('../../assets/avatars/raw/seer.png'),
  shadow: require('../../assets/avatars/raw/shadow.png'),
  silenceElder: require('../../assets/avatars/raw/silenceElder.png'),
  slacker: require('../../assets/avatars/raw/slacker.png'),
  spiritKnight: require('../../assets/avatars/raw/spiritKnight.png'),
  thief: require('../../assets/avatars/raw/thief.png'),
  treasureMaster: require('../../assets/avatars/raw/treasureMaster.png'),
  villager: require('../../assets/avatars/raw/villager.png'),
  votebanElder: require('../../assets/avatars/raw/votebanElder.png'),
  warden: require('../../assets/avatars/raw/warden.png'),
  wildChild: require('../../assets/avatars/raw/wildChild.png'),
  witch: require('../../assets/avatars/raw/witch.png'),
  witcher: require('../../assets/avatars/raw/witcher.png'),
  wolf: require('../../assets/avatars/raw/wolf.png'),
  wolfKing: require('../../assets/avatars/raw/wolfKing.png'),
  wolfQueen: require('../../assets/avatars/raw/wolfQueen.png'),
  wolfRobot: require('../../assets/avatars/raw/wolfRobot.png'),
  wolfWitch: require('../../assets/avatars/raw/wolfWitch.png'),
};

/** All local avatar image sources (2048px raw), in AVATAR_IDS order. */
export const AVATAR_IMAGES: readonly number[] = AVATAR_IDS.map((id) => AVATAR_IMAGE_MAP[id]);

/**
 * Avatar thumbnail registry (exhaustive Record) — AVATAR_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * 512px thumbnails from assets/badges/png/512/.
 */
// prettier-ignore
const AVATAR_THUMB_MAP: Record<AvatarId, number> = {
  avenger: require('../../assets/badges/png/512/role_avenger.png'),
  awakenedGargoyle: require('../../assets/badges/png/512/role_awakenedGargoyle.png'),
  bloodMoon: require('../../assets/badges/png/512/role_bloodMoon.png'),
  crow: require('../../assets/badges/png/512/role_crow.png'),
  cursedFox: require('../../assets/badges/png/512/role_cursedFox.png'),
  cupid: require('../../assets/badges/png/512/role_cupid.png'),
  dancer: require('../../assets/badges/png/512/role_dancer.png'),
  darkWolfKing: require('../../assets/badges/png/512/role_darkWolfKing.png'),
  dreamcatcher: require('../../assets/badges/png/512/role_dreamcatcher.png'),
  drunkSeer: require('../../assets/badges/png/512/role_drunkSeer.png'),
  gargoyle: require('../../assets/badges/png/512/role_gargoyle.png'),
  graveyardKeeper: require('../../assets/badges/png/512/role_graveyardKeeper.png'),
  guard: require('../../assets/badges/png/512/role_guard.png'),
  hunter: require('../../assets/badges/png/512/role_hunter.png'),
  idiot: require('../../assets/badges/png/512/role_idiot.png'),
  knight: require('../../assets/badges/png/512/role_knight.png'),
  magician: require('../../assets/badges/png/512/role_magician.png'),
  maskedMan: require('../../assets/badges/png/512/role_maskedMan.png'),
  masquerade: require('../../assets/badges/png/512/role_masquerade.png'),
  mirrorSeer: require('../../assets/badges/png/512/role_mirrorSeer.png'),
  nightmare: require('../../assets/badges/png/512/role_nightmare.png'),
  piper: require('../../assets/badges/png/512/role_piper.png'),
  poisoner: require('../../assets/badges/png/512/role_poisoner.png'),
  psychic: require('../../assets/badges/png/512/role_psychic.png'),
  pureWhite: require('../../assets/badges/png/512/role_pureWhite.png'),
  seer: require('../../assets/badges/png/512/role_seer.png'),
  shadow: require('../../assets/badges/png/512/role_shadow.png'),
  silenceElder: require('../../assets/badges/png/512/role_silenceElder.png'),
  slacker: require('../../assets/badges/png/512/role_slacker.png'),
  spiritKnight: require('../../assets/badges/png/512/role_spiritKnight.png'),
  thief: require('../../assets/badges/png/512/role_thief.png'),
  treasureMaster: require('../../assets/badges/png/512/role_treasureMaster.png'),
  villager: require('../../assets/badges/png/512/role_villager.png'),
  votebanElder: require('../../assets/badges/png/512/role_votebanElder.png'),
  warden: require('../../assets/badges/png/512/role_warden.png'),
  wildChild: require('../../assets/badges/png/512/role_wildChild.png'),
  witch: require('../../assets/badges/png/512/role_witch.png'),
  witcher: require('../../assets/badges/png/512/role_witcher.png'),
  wolf: require('../../assets/badges/png/512/role_wolf.png'),
  wolfKing: require('../../assets/badges/png/512/role_wolfKing.png'),
  wolfQueen: require('../../assets/badges/png/512/role_wolfQueen.png'),
  wolfRobot: require('../../assets/badges/png/512/role_wolfRobot.png'),
  wolfWitch: require('../../assets/badges/png/512/role_wolfWitch.png'),
};

/** All local avatar thumbnails (512px), in AVATAR_IDS order. */
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

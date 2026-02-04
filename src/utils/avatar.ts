/**
 * Local avatar images for werewolf game
 * 29 dark fantasy style character portraits
 */

// Import all avatar images
const AVATAR_IMAGES = [
  require('../../assets/avatars/villager_001.jpg'),
  require('../../assets/avatars/villager_002.jpg'),
  require('../../assets/avatars/villager_003.jpg'),
  require('../../assets/avatars/villager_004.jpg'),
  require('../../assets/avatars/villager_005.jpg'),
  require('../../assets/avatars/villager_006.jpg'),
  require('../../assets/avatars/villager_007.jpg'),
  require('../../assets/avatars/villager_008.jpg'),
  require('../../assets/avatars/villager_009.jpg'),
  require('../../assets/avatars/villager_010.jpg'),
  require('../../assets/avatars/villager_011.png'),
  require('../../assets/avatars/villager_012.png'),
  require('../../assets/avatars/villager_013.png'),
  require('../../assets/avatars/villager_014.png'),
  require('../../assets/avatars/villager_015.png'),
  require('../../assets/avatars/villager_016.png'),
  require('../../assets/avatars/villager_017.jpg'),
  require('../../assets/avatars/villager_018.jpg'),
  require('../../assets/avatars/villager_019.jpg'),
  require('../../assets/avatars/villager_020.jpg'),
  require('../../assets/avatars/villager_021.jpg'),
  require('../../assets/avatars/villager_022.jpg'),
  require('../../assets/avatars/villager_023.jpg'),
  require('../../assets/avatars/villager_024.jpg'),
  require('../../assets/avatars/villager_025.jpg'),
  require('../../assets/avatars/villager_026.jpg'),
  require('../../assets/avatars/villager_027.jpg'),
  require('../../assets/avatars/villager_028.jpg'),
  require('../../assets/avatars/villager_029.jpg'),
];

/** Export for testing */
export const AVATAR_COUNT = AVATAR_IMAGES.length;

/**
 * Simple deterministic hash function (djb2 algorithm)
 * Returns a non-negative integer
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
export function getDefaultAvatarIndex(roomId: string, uid: string): number {
  // Primary index from uid hash (ensures same user tends to get same base avatar)
  const uidHash = djb2Hash(uid);
  // Room offset to add variety across rooms
  const roomHash = djb2Hash(roomId);
  // Combine: uid determines base, room adds offset
  const index = (uidHash + roomHash) % AVATAR_IMAGES.length;
  return index;
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

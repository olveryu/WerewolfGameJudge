/**
 * Local avatar images for werewolf game
 * 17 dark fantasy style character portraits
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
];

/**
 * Get total number of available avatars
 */
export const getAvatarCount = (): number => AVATAR_IMAGES.length;

/**
 * Get avatar image by index (0-based)
 * Returns a local image source (for use with Image component)
 */
export const getAvatarByIndex = (index: number): number => {
  const safeIndex = Math.abs(index) % AVATAR_IMAGES.length;
  return AVATAR_IMAGES[safeIndex];
};

/**
 * Get a random avatar image based on seed
 * Returns a local image source (for use with Image component)
 */
export const getAvatarImage = (seed: string): number => {
  // Create a hash from the seed to get consistent avatar for same seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.codePointAt(i) || 0;
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % AVATAR_IMAGES.length;
  return AVATAR_IMAGES[index];
};

/**
 * Get unique avatar for a player based on seat number
 * This ensures each player in the same room gets a different avatar
 * @param seatNumber - The player's seat number (1-based)
 * @param roomId - Optional room ID for additional randomization
 */
export const getUniqueAvatarBySeat = (seatNumber: number, roomId?: string): number => {
  // Use room ID to create a room-specific offset so different rooms have different avatar assignments
  let roomOffset = 0;
  if (roomId) {
    for (let i = 0; i < roomId.length; i++) {
      roomOffset += roomId.codePointAt(i) || 0;
    }
  }
  // Seat number is 1-based, convert to 0-based index with room offset
  const index = ((seatNumber - 1) + roomOffset) % AVATAR_IMAGES.length;
  return AVATAR_IMAGES[index];
};

/**
 * Get avatar image for a user
 */
export const getDefaultAvatar = (userId?: string, displayName?: string): number => {
  const seed = displayName || userId || 'anonymous';
  return getAvatarImage(seed);
};

// Keep URL function for backwards compatibility (deprecated)
export const generateAvatarUrl = (seed: string, size = 200): string => {
  const encodedSeed = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/adventurer/png?seed=${encodedSeed}&size=${size}`;
};

export const getDefaultAvatarUrl = (userId?: string, displayName?: string): string => {
  const seed = displayName || userId || 'anonymous';
  return generateAvatarUrl(seed);
};

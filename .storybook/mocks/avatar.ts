/**
 * Storybook mock for avatar utilities
 * Returns placeholder images for web environment
 */

// Placeholder avatar image (gray square)
const PLACEHOLDER_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#4B5563"/>
    <circle cx="50" cy="35" r="20" fill="#9CA3AF"/>
    <ellipse cx="50" cy="85" rx="30" ry="25" fill="#9CA3AF"/>
  </svg>
`);

/**
 * Mock: Returns a placeholder image URL
 */
export const getAvatarImage = (_seed: string): string => {
  return PLACEHOLDER_AVATAR;
};

/**
 * Mock: Returns a placeholder image URL for seat-based avatar
 */
export const getUniqueAvatarBySeat = (_seatNumber: number, _roomId?: string): string => {
  return PLACEHOLDER_AVATAR;
};

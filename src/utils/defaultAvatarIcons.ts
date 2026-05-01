/**
 * defaultAvatarIcons — Wolf paw icon with deterministic color tint
 *
 * Single wolf paw PNG × 20 tint colors. Each player gets a unique color
 * via FNV-1a hash on userId. The PNG is rendered with React Native `tintColor`.
 * 不引入 React、service，也不发起网络请求。
 */
import { type ImageSourcePropType } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WOLF_PAW_IMAGE: ImageSourcePropType = require('../../assets/avatars/seat/wolf-paw.png');

/** Rich color palette for icon tint. 20 colors to minimize repeats in 12-player rooms. */
const AVATAR_COLORS = [
  '#C0392B', // crimson
  '#E67E22', // tangerine
  '#D4AC0D', // gold
  '#27AE60', // emerald
  '#16A085', // teal
  '#2980B9', // ocean
  '#8E44AD', // amethyst
  '#E84393', // magenta
  '#2C3E50', // charcoal
  '#D35400', // rust
  '#1ABC9C', // turquoise
  '#6C5CE7', // indigo
  '#A04000', // bronze
  '#1F618D', // steel blue
  '#7D3C98', // plum
  '#196F3D', // forest
  '#CB4335', // scarlet
  '#5B2C6F', // grape
  '#1A5276', // navy
  '#B7950B', // amber
] as const;

/**
 * FNV-1a hash — good avalanche for short similar strings like "bot-0" .. "bot-11".
 */
function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.codePointAt(i) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

interface AvatarIconInfo {
  image: ImageSourcePropType;
  color: string;
}

/**
 * Get the wolf paw icon with a deterministic tint color for a user.
 * Color selected via FNV-1a hash on userId.
 */
export function getAvatarIcon(userId: string): AvatarIconInfo {
  const colorIndex = fnv1aHash(userId) % AVATAR_COLORS.length;
  return {
    image: WOLF_PAW_IMAGE,
    color: AVATAR_COLORS[colorIndex],
  };
}

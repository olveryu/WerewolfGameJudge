/**
 * lucideAvatars - Lucide line-icon pool for anonymous user avatars
 *
 * 50 nature/object themed Lucide icon names used as anonymous player avatars.
 * 提供基于 uid/roomId 的稳定 hash 分配和房间内去重，与 avatar.ts 中注册用户的
 * 暗黑肖像系统平行。不含 React 组件——组件层在 Avatar.tsx 中使用 icon name 渲染。
 */

import type { LucideIcon } from 'lucide-react-native';
import {
  Anchor,
  Apple,
  Banana,
  Bird,
  Bug,
  Cake,
  Candy,
  Cat,
  Cherry,
  Citrus,
  Cloud,
  Clover,
  Compass,
  Crown,
  Dice5 as Dice,
  Dog,
  Drumstick,
  Eye,
  Feather,
  Fish,
  Flame,
  Flower2,
  Footprints,
  Gem,
  Ghost,
  Grape,
  Heart,
  IceCreamCone,
  Leaf,
  Moon,
  Mountain,
  Music,
  Palette,
  PawPrint,
  Pizza,
  Rabbit,
  Rainbow,
  Rocket,
  Shield,
  Skull,
  Snail,
  Snowflake,
  Sparkles,
  Squirrel,
  Star,
  Swords,
  TreePine,
  Turtle,
  Wand,
  Zap,
} from 'lucide-react-native';

/** All Lucide icon components in the anonymous avatar pool (50 icons). */
export const LUCIDE_AVATAR_ICONS: LucideIcon[] = [
  // Animals & nature
  Cat,
  Dog,
  Bird,
  Fish,
  Rabbit,
  Squirrel,
  Bug,
  Turtle,
  Snail,
  PawPrint,
  Footprints,
  // Plants & landscape
  Leaf,
  TreePine,
  Flower2,
  Clover,
  Cherry,
  Mountain,
  // Weather & sky
  Cloud,
  Flame,
  Snowflake,
  Moon,
  Star,
  Rainbow,
  Sparkles,
  Zap,
  // Adventure & objects
  Compass,
  Anchor,
  Gem,
  Crown,
  Feather,
  Ghost,
  Rocket,
  Skull,
  Wand,
  Shield,
  Swords,
  Eye,
  Heart,
  // Arts & entertainment
  Music,
  Palette,
  Dice,
  // Food & treats
  Apple,
  Citrus,
  Grape,
  Banana,
  Candy,
  IceCreamCone,
  Cake,
  Pizza,
  Drumstick,
];

/**
 * 16 distinguishable colors for anonymous avatars (Material Design 300 level).
 * Chosen for good contrast on both light & dark backgrounds.
 */
const LUCIDE_AVATAR_COLORS: readonly string[] = [
  '#E57373', // red 300
  '#F06292', // pink 300
  '#BA68C8', // purple 300
  '#9575CD', // deep purple 300
  '#7986CB', // indigo 300
  '#64B5F6', // blue 300
  '#4FC3F7', // light blue 300
  '#4DD0E1', // cyan 300
  '#4DB6AC', // teal 300
  '#81C784', // green 300
  '#AED581', // light green 300
  '#DCE775', // lime 300
  '#FFD54F', // amber 300
  '#FFB74D', // orange 300
  '#FF8A65', // deep orange 300
  '#A1887F', // brown 300
];

/**
 * Get a color for an anonymous avatar by its Lucide icon index.
 * Uses the same index as the icon assignment (index % 16).
 */
export function getLucideColorByIndex(index: number): string {
  const safeIndex = Math.abs(index) % LUCIDE_AVATAR_COLORS.length;
  return LUCIDE_AVATAR_COLORS[safeIndex];
}

/**
 * FNV-1a hash — same algorithm as avatar.ts for consistency.
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
 * Get the preferred Lucide icon index for an anonymous user in a room.
 */
function getDefaultLucideIndex(roomId: string, uid: string): number {
  const combined = `${roomId}:${uid}`;
  return fnv1aHash(combined) % LUCIDE_AVATAR_ICONS.length;
}

/**
 * Assign guaranteed-unique Lucide icon indices to anonymous UIDs within one room.
 *
 * Same linear-probe algorithm as getUniqueAvatarMap in avatar.ts.
 * With 50 icons and ≤12 players this always succeeds.
 *
 * @param roomId - The room identifier
 * @param uids   - Ordered list of anonymous player UIDs
 * @returns Map from uid → unique Lucide icon index (0-based)
 */
export function getUniqueLucideAvatarMap(roomId: string, uids: string[]): Map<string, number> {
  const N = LUCIDE_AVATAR_ICONS.length;
  const taken = new Set<number>();
  const result = new Map<string, number>();

  for (const uid of uids) {
    let idx = getDefaultLucideIndex(roomId, uid);
    while (taken.has(idx)) {
      idx = (idx + 1) % N;
    }
    taken.add(idx);
    result.set(uid, idx);
  }

  return result;
}

/**
 * Get a Lucide icon component by index.
 */
export function getLucideIconByIndex(index: number): LucideIcon {
  const safeIndex = Math.abs(index) % LUCIDE_AVATAR_ICONS.length;
  return LUCIDE_AVATAR_ICONS[safeIndex];
}

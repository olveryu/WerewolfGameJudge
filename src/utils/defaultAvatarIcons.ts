/**
 * defaultAvatarIcons — Lucide icon registry for default user avatars
 *
 * 100 visually distinct icons × 20 tint colors = 2000 unique combinations.
 * Deterministic selection via FNV-1a hash on uid.
 * 不引入 React、service，也不发起网络请求。
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  Anchor,
  Apple,
  Atom,
  Axe,
  Baby,
  Banana,
  Bean,
  Beer,
  Bell,
  Bird,
  Blocks,
  Bomb,
  Bone,
  Book,
  Bot,
  Briefcase,
  Bug,
  Cake,
  Camera,
  Car,
  Cat,
  Cherry,
  CircleUser,
  Citrus,
  Clover,
  Coffee,
  Compass,
  Cookie,
  Crown,
  CupSoda,
  Diamond,
  Dice1,
  Dog,
  Drama,
  Drum,
  Dumbbell,
  Ear,
  Egg,
  Eye,
  Fan,
  Feather,
  Fingerprint,
  Fish,
  Flame,
  Flower,
  Footprints,
  Gem,
  Ghost,
  Gift,
  Globe,
  Grape,
  Guitar,
  Hammer,
  HandMetal,
  Headphones,
  Heart,
  Hexagon,
  IceCreamCone,
  Key,
  Lamp,
  Leaf,
  Lightbulb,
  Locate,
  Lollipop,
  MapPin,
  Moon,
  Mountain,
  Music,
  Orbit,
  Origami,
  Palmtree,
  PawPrint,
  Pen,
  Pentagon,
  Piano,
  Pill,
  Pizza,
  Popcorn,
  Puzzle,
  Rabbit,
  Rainbow,
  Rocket,
  Sailboat,
  Sandwich,
  Scissors,
  Shell,
  Shield,
  Skull,
  Snail,
  Snowflake,
  Sparkles,
  Squirrel,
  Star,
  Sun,
  Sword,
  Target,
  Telescope,
  Tent,
  TreePine,
  Turtle,
  Umbrella,
  Wand,
  Waves,
  Zap,
} from 'lucide-react-native';

/** 100 visually distinct Lucide icons for default avatars. */
export const AVATAR_ICONS: readonly LucideIcon[] = [
  Anchor,
  Apple,
  Atom,
  Axe,
  Baby,
  Banana,
  Bean,
  Beer,
  Bell,
  Bird,
  Blocks,
  Bomb,
  Bone,
  Book,
  Bot,
  Briefcase,
  Bug,
  Cake,
  Camera,
  Car,
  Cat,
  Cherry,
  CircleUser,
  Citrus,
  Clover,
  Coffee,
  Compass,
  Cookie,
  Crown,
  CupSoda,
  Diamond,
  Dice1,
  Dog,
  Drama,
  Drum,
  Dumbbell,
  Ear,
  Egg,
  Eye,
  Fan,
  Feather,
  Fingerprint,
  Fish,
  Flame,
  Flower,
  Footprints,
  Gem,
  Ghost,
  Gift,
  Globe,
  Grape,
  Guitar,
  Hammer,
  HandMetal,
  Headphones,
  Heart,
  Hexagon,
  IceCreamCone,
  Key,
  Lamp,
  Leaf,
  Lightbulb,
  Locate,
  Lollipop,
  MapPin,
  Moon,
  Mountain,
  Music,
  Orbit,
  Origami,
  Palmtree,
  PawPrint,
  Pen,
  Pentagon,
  Popcorn,
  Piano,
  Pill,
  Pizza,
  Puzzle,
  Rabbit,
  Rainbow,
  Rocket,
  Sailboat,
  Sandwich,
  Scissors,
  Shell,
  Shield,
  Skull,
  Snail,
  Snowflake,
  Sparkles,
  Squirrel,
  Star,
  Sun,
  Sword,
  Target,
  Telescope,
  Tent,
  TreePine,
  Turtle,
  Umbrella,
  Wand,
  Waves,
  Zap,
] as const;

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

export interface AvatarIconInfo {
  Icon: LucideIcon;
  color: string;
}

/**
 * Get a deterministic icon + color combo for a user.
 * Uses two independent hashes (icon from uid, color from reversed uid) to
 * maximize visual diversity — same icon rarely gets same color.
 */
export function getAvatarIcon(uid: string): AvatarIconInfo {
  const iconIndex = fnv1aHash(uid) % AVATAR_ICONS.length;
  // Reverse uid for independent color hash to avoid correlated icon+color
  const colorIndex = fnv1aHash(uid.split('').reverse().join('')) % AVATAR_COLORS.length;
  return {
    Icon: AVATAR_ICONS[iconIndex],
    color: AVATAR_COLORS[colorIndex],
  };
}

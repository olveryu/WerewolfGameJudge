import type {
  NameStyleId,
  Rarity,
  RoleRevealEffectId,
} from '@werewolf/game-engine/growth/rewardCatalog';

import type { FrameId } from '@/components/avatarFrames';
import { createRoleData } from '@/components/RoleRevealEffects';
import type { FlairId } from '@/components/seatFlairs';

export const NUM_COLUMNS = 4;
export const FRAME_NUM_COLUMNS = 3;
export const FRAME_GRID_CELL_SIZE = 72;
export const HERO_PREVIEW_SIZE = 80;

/** Preview uses a real villager role so RoleCardContent can resolve ROLE_SPECS. */
export const PREVIEW_ROLE = createRoleData('villager', '村民', 'villager');

/** Multiple roles for roulette/roleHunt/fortuneWheel preview (need scroll targets). */
export const PREVIEW_ALL_ROLES = [
  PREVIEW_ROLE,
  createRoleData('wolf', '狼人', 'wolf'),
  createRoleData('seer', '预言家', 'god'),
  createRoleData('witch', '女巫', 'god'),
  createRoleData('hunter', '猎人', 'god'),
  createRoleData('guard', '守卫', 'god'),
];

export type Selection = number | 'custom' | 'default' | null;
export type PickerTab = 'avatar' | 'frame' | 'flair' | 'nameStyle' | 'effect';
export type RarityFilter = 'all' | Rarity;

/** Discriminated union for all avatar grid cells: special (default/custom) + builtin + placeholder */
export type AvatarCellItem =
  | { key: string; type: 'default' }
  | { key: string; type: 'custom' }
  | { key: string; type: 'builtin'; index: number }
  | { key: string; type: 'placeholder' };

/** Unified item type for frame FlatList, including the "none" sentinel. */
export interface FrameGridItem {
  id: FrameId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

export interface FlairGridItem {
  id: FlairId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

export interface NameStyleGridItem {
  id: NameStyleId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

export interface EffectGridItem {
  id: RoleRevealEffectId | 'none' | 'random';
  name: string;
  icon: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

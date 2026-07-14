import type {
  NameStyleId,
  Rarity,
  RoleRevealEffectId,
  SeatAnimationId,
} from '@werewolf/game-engine/growth/rewardCatalog';

import type { FrameId } from '@/components/avatarFrames';
import type { FlairId } from '@/components/seatFlairs';
import type { ProductIconName } from '@/features/product/model/GameProductUi';

/** Number of columns in the avatar grid. */
export const NUM_COLUMNS = 4;
/** Number of columns in the frame grid. */
export const FRAME_NUM_COLUMNS = 3;
/** Cell size in the frame grid. */
export const FRAME_GRID_CELL_SIZE = 72;
/** Hero preview size. */
export const HERO_PREVIEW_SIZE = 80;

/** Currently selected avatar ID. */
export type Selection = string | null;
/** Appearance picker tab. */
export type PickerTab = 'avatar' | 'frame' | 'flair' | 'nameStyle' | 'effect' | 'seatAnimation';
/** Rarity filter. */
export type RarityFilter = 'all' | Rarity;

/** Discriminated union for all avatar grid cells. */
export type AvatarCellItem =
  | { key: string; type: 'default' }
  | { key: string; type: 'custom' }
  | { key: string; type: 'avatar'; avatarId: string }
  | { key: string; type: 'placeholder' };

/** Frame grid item. */
export interface FrameGridItem {
  id: FrameId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** Honor flair grid item. */
export interface FlairGridItem {
  id: FlairId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** Name style grid item. */
export interface NameStyleGridItem {
  id: NameStyleId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** Effect grid item. */
export interface EffectGridItem {
  id: RoleRevealEffectId | 'none' | 'random';
  name: string;
  icon: ProductIconName;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** Seat animation grid item. */
export interface SeatAnimationGridItem {
  id: SeatAnimationId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

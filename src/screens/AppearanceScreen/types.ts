import type {
  NameStyleId,
  Rarity,
  RoleRevealEffectId,
  SeatAnimationId,
} from '@werewolf/game-engine/growth/rewardCatalog';

import type { FrameId } from '@/components/avatarFrames';
import { createRoleData } from '@/components/RoleRevealEffects';
import type { FlairId } from '@/components/seatFlairs';

/** 头像网格列数。 */
export const NUM_COLUMNS = 4;
/** 框网格列数。 */
export const FRAME_NUM_COLUMNS = 3;
/** 框网格单元格尺寸。 */
export const FRAME_GRID_CELL_SIZE = 72;
/** 主预览尺寸。 */
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

/** 当前选中的头像 ID。 */
export type Selection = string | null;
/** 外观选择器页签。 */
export type PickerTab = 'avatar' | 'frame' | 'flair' | 'nameStyle' | 'effect' | 'seatAnimation';
/** 稀有度筛选。 */
export type RarityFilter = 'all' | Rarity;

/** Discriminated union for all avatar grid cells. */
export type AvatarCellItem =
  | { key: string; type: 'default' }
  | { key: string; type: 'custom' }
  | { key: string; type: 'avatar'; avatarId: string }
  | { key: string; type: 'placeholder' };

/** 框网格条目。 */
export interface FrameGridItem {
  id: FrameId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** 德誉网格条目。 */
export interface FlairGridItem {
  id: FlairId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** 名字样式网格条目。 */
export interface NameStyleGridItem {
  id: NameStyleId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** 特效网格条目。 */
export interface EffectGridItem {
  id: RoleRevealEffectId | 'none' | 'random';
  name: string;
  icon: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

/** 入座动画网格条目。 */
export interface SeatAnimationGridItem {
  id: SeatAnimationId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

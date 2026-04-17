/**
 * rarityVisual — 稀有度显示元数据（颜色、标签、辉光、chip 阴影）。
 *
 * GachaScreen / UnlocksScreen / AvatarPickerScreen 共用。
 */
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';

import { withAlpha } from '@/theme';

export interface RarityVisual {
  /** 主题色 */
  color: string;
  /** Skia 粒子辉光 */
  glow: string;
  /** 中文标签 */
  label: string;
  /** Active chip 的带色 boxShadow（30% 主题色） */
  chipShadow: string;
}

/** 从高到低的稀有度显示顺序 */
export const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

const mkVisual = (color: string, glow: string, label: string): RarityVisual => ({
  color,
  glow,
  label,
  chipShadow: `0px 2px 8px ${withAlpha(color, 0.35)}`,
});

export const RARITY_VISUAL: Record<Rarity, RarityVisual> = {
  common: mkVisual('#9E9E9E', 'rgba(158,158,158,0.3)', '普通'),
  rare: mkVisual('#4A90D9', 'rgba(74,144,217,0.4)', '稀有'),
  epic: mkVisual('#9B59B6', 'rgba(155,89,182,0.5)', '史诗'),
  legendary: mkVisual('#F5A623', 'rgba(245,166,35,0.5)', '传说'),
};

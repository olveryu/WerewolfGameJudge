/**
 * rarityVisual — 稀有度显示元数据（颜色、标签、辉光）。
 *
 * GachaScreen / UnlocksScreen / AvatarPickerScreen 共用。
 */
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';

/** 从高到低的稀有度显示顺序 */
export const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

export const RARITY_VISUAL: Record<Rarity, { color: string; glow: string; label: string }> = {
  common: { color: '#9E9E9E', glow: 'rgba(158,158,158,0.3)', label: '普通' },
  rare: { color: '#4A90D9', glow: 'rgba(74,144,217,0.4)', label: '稀有' },
  epic: { color: '#9B59B6', glow: 'rgba(155,89,182,0.5)', label: '史诗' },
  legendary: { color: '#F5A623', glow: 'rgba(245,166,35,0.5)', label: '传说' },
};

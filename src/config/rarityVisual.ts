/**
 * rarityVisual — 稀有度显示元数据（颜色、标签、辉光、chip 阴影、格子样式）。
 *
 * GachaScreen / UnlocksScreen / AppearanceScreen 共用。
 */
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import type { ViewStyle } from 'react-native';

import { withAlpha } from '@/theme';

interface RarityVisual {
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

// ─── Collection grid cell rarity styling ────────────────────────────────

/** Rarity-based visual config for collection/picker grid cells */
interface RarityCellConfig {
  /** Top → bottom gradient colors for cell background tint */
  gradientColors: readonly [string, string];
  /** boxShadow glow (legendary only, empty for others) */
  glow: ViewStyle;
}

/**
 * Cell configs for rare+ items. Common items get no special treatment.
 * Colors derived from RARITY_VISUAL to stay in sync with rarity theme.
 */
const RARITY_CELL: Record<Exclude<Rarity, 'common'>, RarityCellConfig> = {
  rare: {
    gradientColors: [
      withAlpha(RARITY_VISUAL.rare.color, 0.03),
      withAlpha(RARITY_VISUAL.rare.color, 0.18),
    ],
    glow: {} as ViewStyle,
  },
  epic: {
    gradientColors: [
      withAlpha(RARITY_VISUAL.epic.color, 0.05),
      withAlpha(RARITY_VISUAL.epic.color, 0.25),
    ],
    glow: {} as ViewStyle,
  },
  legendary: {
    gradientColors: [
      withAlpha(RARITY_VISUAL.legendary.color, 0.08),
      withAlpha(RARITY_VISUAL.legendary.color, 0.3),
    ],
    glow: {
      boxShadow: `0px 0px 10px ${withAlpha(RARITY_VISUAL.legendary.color, 0.25)}`,
    } as ViewStyle,
  },
};

/** Returns cell visual config for a rarity, or null for common/missing. */
export function getRarityCellConfig(rarity: Rarity | null): RarityCellConfig | null {
  if (!rarity || rarity === 'common') return null;
  return RARITY_CELL[rarity];
}

/** Flat style (legendary glow only) for a rarity cell, or null for common/missing. */
export function getRarityCellStyle(rarity: Rarity | null): ViewStyle | null {
  const cfg = getRarityCellConfig(rarity);
  if (!cfg) return null;
  // Rarity is communicated via RarityCellBg background gradient (mainstream pattern).
  // Border channel is reserved for selection state.
  if (Object.keys(cfg.glow).length === 0) return null;
  return cfg.glow;
}

/** Selected-state style: border + tinted background follow the rarity theme color. */
export function getRaritySelectedStyle(rarity: Rarity | null): ViewStyle {
  const color = RARITY_VISUAL[rarity ?? 'common'].color;
  return { borderColor: color, backgroundColor: withAlpha(color, 0.08) };
}

const RARITY_INDEX: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

/** Compare two rarities in descending order (legendary first). Stable for equal. */
export function compareByRarity(a: Rarity | null, b: Rarity | null): number {
  return (RARITY_INDEX[a ?? 'common'] ?? 3) - (RARITY_INDEX[b ?? 'common'] ?? 3);
}

/**
 * Rarity display metadata (colour, label, chip shadow, grid-cell tint), shared by the appearance
 * and unlocks pages. Pure data and helpers; no game state or IO.
 */
import type { Rarity } from '@game-judge/game-engine/product/rewards';
import type { CSSProperties } from 'react';

import { withAlpha } from '@/theme/colorUtils';

interface RarityVisual {
  /** Theme colour. */
  readonly color: string;
  /** Display label. */
  readonly label: string;
  /** Coloured shadow of an active filter chip. */
  readonly chipShadow: string;
}

/** Rarity display order, highest first. */
export const RARITY_ORDER: readonly Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];

function visual(color: string, label: string): RarityVisual {
  return { color, label, chipShadow: `0px 2px 8px ${withAlpha(color, 0.35)}` };
}

export const RARITY_VISUAL: Readonly<Record<Rarity, RarityVisual>> = {
  mythic: visual('#C73D5C', '神话'),
  common: visual('#9E9E9E', '普通'),
  rare: visual('#4A90D9', '稀有'),
  epic: visual('#9B59B6', '史诗'),
  legendary: visual('#F5A623', '传说'),
};

/** Stars shown before a rarity label, one per tier. */
const RARITY_STARS: Readonly<Record<Rarity, number>> = {
  mythic: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

/** `★★★ 史诗`-style rarity caption. */
export function rarityStarLabel(rarity: Rarity): string {
  return `${'★'.repeat(RARITY_STARS[rarity])} ${RARITY_VISUAL[rarity].label}`;
}

interface RarityCellConfig {
  /** Top and bottom colours of the cell's background tint. */
  readonly gradient: readonly [string, string];
  /** Outer glow, or `undefined` when the tier has none. */
  readonly glow: string | undefined;
}

function cell(
  rarity: Rarity,
  top: number,
  bottom: number,
  glow?: { readonly blur: number; readonly alpha: number },
): RarityCellConfig {
  const { color } = RARITY_VISUAL[rarity];
  return {
    gradient: [withAlpha(color, top), withAlpha(color, bottom)],
    glow: glow && `0px 0px ${glow.blur}px ${withAlpha(color, glow.alpha)}`,
  };
}

/** Grid-cell tints for rare and better; common cells get no special treatment. */
const RARITY_CELL: Readonly<Record<Exclude<Rarity, 'common'>, RarityCellConfig>> = {
  mythic: cell('mythic', 0.08, 0.3, { blur: 12, alpha: 0.3 }),
  rare: cell('rare', 0.03, 0.18),
  epic: cell('epic', 0.05, 0.25),
  legendary: cell('legendary', 0.08, 0.3, { blur: 10, alpha: 0.25 }),
};

/** The grid-cell tint of `rarity`, or `null` for common and unrated items. */
export function getRarityCellConfig(rarity: Rarity | null): RarityCellConfig | null {
  return rarity === null || rarity === 'common' ? null : RARITY_CELL[rarity];
}

/**
 * The cell's glow (mythic and legendary only). Rarity shows through the background tint; the
 * border is reserved for the selection state.
 */
export function getRarityCellStyle(rarity: Rarity | null): CSSProperties | undefined {
  const glow = getRarityCellConfig(rarity)?.glow;
  return glow === undefined ? undefined : { boxShadow: glow };
}

/** Selected state: border and tinted background follow the rarity colour. */
export function getRaritySelectedStyle(rarity: Rarity | null): CSSProperties {
  const { color } = RARITY_VISUAL[rarity ?? 'common'];
  return { borderColor: color, backgroundColor: withAlpha(color, 0.08) };
}

/** Orders rarities highest first; unrated items count as common. */
function compareByRarity(a: Rarity | null, b: Rarity | null): number {
  return RARITY_ORDER.indexOf(a ?? 'common') - RARITY_ORDER.indexOf(b ?? 'common');
}

/** Collection order: unlocked items first, then highest rarity first. */
export function compareUnlockedThenRarity(
  a: { readonly unlocked: boolean; readonly rarity: Rarity | null },
  b: { readonly unlocked: boolean; readonly rarity: Rarity | null },
): number {
  return Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity);
}

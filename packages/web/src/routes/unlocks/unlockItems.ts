/** The unlocks page's collection items: every catalog item of a category, unlocked first. */
import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  getItemRarity,
  NAME_STYLE_IDS,
  type Rarity,
  ROLE_REVEAL_EFFECT_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';

import { compareUnlockedThenRarity } from '@/config/rarityVisual';
import type { CosmeticTab, RarityFilter } from '@/features/product/components/CosmeticTabs';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import {
  cosmeticName,
  FLAIR_NAMES,
  FRAME_NAMES,
  NAME_STYLE_NAMES,
  SEAT_ANIMATION_NAMES,
} from '@/features/product/model/cosmeticNames';

/** One collection item as the unlocks grid shows it. */
export interface UnlockItem {
  readonly id: string;
  readonly displayName: string;
  readonly unlocked: boolean;
  readonly rarity: Rarity;
}

function categoryCatalog(
  tab: CosmeticTab,
  productUi: ClientProductUi,
): readonly { readonly id: string; readonly displayName: string }[] {
  switch (tab) {
    case 'avatar':
      return AVATAR_IDS.map((id) => ({ id, displayName: productUi.getAvatarDisplayName(id) }));
    case 'frame':
      return FRAME_IDS.map((id) => ({ id, displayName: cosmeticName(FRAME_NAMES, id) }));
    case 'flair':
      return SEAT_FLAIR_IDS.map((id) => ({ id, displayName: cosmeticName(FLAIR_NAMES, id) }));
    case 'nameStyle':
      return NAME_STYLE_IDS.map((id) => ({ id, displayName: cosmeticName(NAME_STYLE_NAMES, id) }));
    case 'effect':
      return ROLE_REVEAL_EFFECT_IDS.map((id) => ({
        id,
        displayName: productUi.getRevealEffectPresentation(id).label,
      }));
    case 'seatAnimation':
      return SEAT_ANIMATION_IDS.map((id) => ({
        id,
        displayName: cosmeticName(SEAT_ANIMATION_NAMES, id),
      }));
  }
}

/** The owned set: free avatars and frames plus the account's unlocked items. */
export function buildUnlockedSet(unlockedItems: readonly string[]): ReadonlySet<string> {
  return new Set([...FREE_AVATAR_IDS, ...FREE_FRAME_IDS, ...unlockedItems]);
}

/** Every item of `tab`, unlocked first, then highest rarity first. */
export function buildUnlockItems(
  tab: CosmeticTab,
  unlockedSet: ReadonlySet<string>,
  productUi: ClientProductUi,
): UnlockItem[] {
  return categoryCatalog(tab, productUi)
    .map(({ id, displayName }) => ({
      id,
      displayName,
      unlocked: unlockedSet.has(id),
      rarity: getItemRarity(id),
    }))
    .sort(compareUnlockedThenRarity);
}

/** Items of one rarity (every item is rated, so nothing else is kept). */
export function filterUnlockItems(
  items: readonly UnlockItem[],
  rarityFilter: RarityFilter,
): readonly UnlockItem[] {
  return rarityFilter === 'all' ? items : items.filter((item) => item.rarity === rarityFilter);
}

/** Progress over the whole category, regardless of the rarity filter. */
export function summarizeProgress(items: readonly UnlockItem[]): {
  readonly unlockedCount: number;
  readonly totalCount: number;
  readonly percent: number;
} {
  const unlockedCount = items.filter((item) => item.unlocked).length;
  const totalCount = items.length;
  return { unlockedCount, totalCount, percent: Math.round((unlockedCount / totalCount) * 100) };
}

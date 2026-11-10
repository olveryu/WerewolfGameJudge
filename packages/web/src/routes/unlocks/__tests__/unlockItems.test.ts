/** Unlocks collection model: owned set, ordering, rarity filter and progress. */
import {
  AVATAR_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  NAME_STYLE_IDS,
  ROLE_REVEAL_EFFECT_IDS,
} from '@game-judge/game-engine/product/rewards';

import { RARITY_ORDER } from '@/config/rarityVisual';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { NAME_STYLE_NAMES } from '@/features/product/model/cosmeticNames';
import {
  buildUnlockedSet,
  buildUnlockItems,
  filterUnlockItems,
  summarizeProgress,
} from '@/routes/unlocks/unlockItems';

describe('unlock items', () => {
  it('owns the free avatars and frames plus the unlocked items', () => {
    const owned = buildUnlockedSet(['bought']);

    expect([...FREE_AVATAR_IDS, ...FREE_FRAME_IDS, 'bought'].every((id) => owned.has(id))).toBe(
      true,
    );
  });

  it('lists every item of a category, unlocked first, then highest rarity first', async () => {
    const productUi = await loadClientProductUi();
    const nameStyleId = NAME_STYLE_IDS.at(-1);
    if (nameStyleId === undefined) throw new Error('No name styles');

    const items = buildUnlockItems('nameStyle', buildUnlockedSet([nameStyleId]), productUi);

    expect(items).toHaveLength(NAME_STYLE_IDS.length);
    expect(items[0]).toMatchObject({
      id: nameStyleId,
      displayName: NAME_STYLE_NAMES[nameStyleId],
      unlocked: true,
    });
    const lockedRanks = items.slice(1).map((item) => RARITY_ORDER.indexOf(item.rarity));
    expect(lockedRanks).toEqual([...lockedRanks].sort((a, b) => a - b));
  });

  it('names avatars and reveal effects through the product UI', async () => {
    const productUi = await loadClientProductUi();
    const owned = buildUnlockedSet([]);

    const avatars = buildUnlockItems('avatar', owned, productUi);
    const effects = buildUnlockItems('effect', owned, productUi);

    expect(avatars).toHaveLength(AVATAR_IDS.length);
    expect(effects.map((item) => item.displayName).sort()).toEqual(
      ROLE_REVEAL_EFFECT_IDS.map((id) => productUi.getRevealEffectPresentation(id).label).sort(),
    );
  });

  it('filters by rarity and reports progress over the whole category', async () => {
    const productUi = await loadClientProductUi();
    const items = buildUnlockItems('avatar', buildUnlockedSet([]), productUi);
    const rarity = items[0]?.rarity;
    if (rarity === undefined) throw new Error('No avatars');

    expect(filterUnlockItems(items, 'all')).toBe(items);
    expect(filterUnlockItems(items, rarity).every((item) => item.rarity === rarity)).toBe(true);
    expect(summarizeProgress(items)).toEqual({
      unlockedCount: FREE_AVATAR_IDS.size,
      totalCount: AVATAR_IDS.length,
      percent: Math.round((FREE_AVATAR_IDS.size / AVATAR_IDS.length) * 100),
    });
  });
});

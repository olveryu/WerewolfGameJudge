/** Appearance picker grids: catalog items in display order (unlocked first, then rarity). */
import {
  AVATAR_IDS,
  FRAME_IDS,
  getItemRarity,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
  NAME_STYLE_IDS,
  type Rarity,
  ROLE_REVEAL_EFFECT_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';

import { compareUnlockedThenRarity } from '@/config/rarityVisual';
import type { RarityFilter } from '@/features/product/components/CosmeticTabs';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import {
  cosmeticName,
  FLAIR_NAMES,
  FRAME_NAMES,
  NAME_STYLE_NAMES,
  SEAT_ANIMATION_NAMES,
} from '@/features/product/model/cosmeticNames';

import type {
  AvatarCellItem,
  CosmeticGridItem,
  EffectGridItem,
  FlairGridItem,
  FrameGridItem,
  NameStyleGridItem,
  SeatAnimationGridItem,
} from './types';

interface Sortable {
  readonly unlocked: boolean;
  readonly rarity: Rarity | null;
}

/** The avatar grid: `default` and `custom` choices (editable accounts only), then the catalog. */
export function buildAvatarGridData(
  unlockedAvatars: ReadonlySet<string>,
  readOnly: boolean,
  customAvatarUrl: string | null,
): AvatarCellItem[] {
  const specials: AvatarCellItem[] = readOnly ? [] : [{ key: 'special-default', type: 'default' }];
  if (!readOnly && customAvatarUrl) specials.push({ key: 'special-custom', type: 'custom' });
  const avatars = AVATAR_IDS.map((avatarId) => ({
    avatarId,
    unlocked: unlockedAvatars.has(avatarId),
    rarity: getItemRarity(avatarId),
  }))
    .sort(compareUnlockedThenRarity)
    .map(({ avatarId }): AvatarCellItem => ({ key: avatarId, type: 'avatar', avatarId }));
  return [...specials, ...avatars];
}

/** Catalog avatars of one rarity; `all` keeps the special choices too. */
export function filterAvatarGridData(
  data: readonly AvatarCellItem[],
  rarityFilter: RarityFilter,
): readonly AvatarCellItem[] {
  if (rarityFilter === 'all') return data;
  return data.filter(
    (item) => item.type === 'avatar' && getItemRarity(item.avatarId) === rarityFilter,
  );
}

/** Items of one rarity plus the unrated `none` / `random` choices. */
export function filterGridDataByRarity<Item extends Sortable>(
  data: readonly Item[],
  rarityFilter: RarityFilter,
): readonly Item[] {
  if (rarityFilter === 'all') return data;
  return data.filter((item) => item.rarity === null || item.rarity === rarityFilter);
}

function buildCosmeticGrid<Id extends string>(
  ids: readonly Id[],
  names: Readonly<Record<string, string>>,
  isUnlocked: (id: string, unlockedIds: readonly string[]) => boolean,
  unlockedIds: readonly string[],
  currentId: string | null,
): CosmeticGridItem<Id | 'none'>[] {
  const none: CosmeticGridItem<'none'> = {
    id: 'none',
    name: '无',
    unlocked: true,
    isActive: !currentId,
    rarity: null,
  };
  const items = ids.map(
    (id): CosmeticGridItem<Id> => ({
      id,
      name: cosmeticName(names, id),
      unlocked: isUnlocked(id, unlockedIds),
      isActive: currentId === id,
      rarity: getItemRarity(id),
    }),
  );
  return [none, ...items.sort(compareUnlockedThenRarity)];
}

export function buildFrameGridData(
  unlockedIds: readonly string[],
  currentFrameId: string | null,
): FrameGridItem[] {
  return buildCosmeticGrid(FRAME_IDS, FRAME_NAMES, isFrameUnlocked, unlockedIds, currentFrameId);
}

export function buildFlairGridData(
  unlockedIds: readonly string[],
  currentFlairId: string | null,
): FlairGridItem[] {
  return buildCosmeticGrid(
    SEAT_FLAIR_IDS,
    FLAIR_NAMES,
    isFlairUnlocked,
    unlockedIds,
    currentFlairId,
  );
}

export function buildNameStyleGridData(
  unlockedIds: readonly string[],
  currentNameStyleId: string | null,
): NameStyleGridItem[] {
  return buildCosmeticGrid(
    NAME_STYLE_IDS,
    NAME_STYLE_NAMES,
    isNameStyleUnlocked,
    unlockedIds,
    currentNameStyleId,
  );
}

export function buildSeatAnimationGridData(
  unlockedIds: readonly string[],
  currentSeatAnimationId: string | null,
): SeatAnimationGridItem[] {
  return buildCosmeticGrid(
    SEAT_ANIMATION_IDS,
    SEAT_ANIMATION_NAMES,
    isSeatAnimationUnlocked,
    unlockedIds,
    currentSeatAnimationId,
  );
}

/** The effect grid: `none`, `random`, then the catalog effects with their game-owned labels. */
export function buildEffectGridData(
  productUi: ClientProductUi,
  unlockedIds: readonly string[],
  currentEquippedEffect: string | null,
): EffectGridItem[] {
  const none: EffectGridItem = {
    id: 'none',
    name: '无',
    icon: 'close-circle-outline',
    unlocked: true,
    isActive: !currentEquippedEffect,
    rarity: null,
  };
  const random: EffectGridItem = {
    id: 'random',
    name: '随机',
    icon: 'shuffle-outline',
    unlocked: true,
    isActive: currentEquippedEffect === 'random',
    rarity: null,
  };
  const items = ROLE_REVEAL_EFFECT_IDS.map((id): EffectGridItem => {
    const presentation = productUi.getRevealEffectPresentation(id);
    return {
      id,
      name: presentation.label,
      icon: presentation.icon,
      unlocked: isRoleRevealEffectUnlocked(id, unlockedIds),
      isActive: currentEquippedEffect === id,
      rarity: getItemRarity(id),
    };
  });
  return [none, random, ...items.sort(compareUnlockedThenRarity)];
}

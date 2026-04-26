import {
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
} from '@werewolf/game-engine/growth/frameUnlock';
import { getItemRarity, ROLE_REVEAL_EFFECT_IDS } from '@werewolf/game-engine/growth/rewardCatalog';

import { AVATAR_FRAMES } from '@/components/avatarFrames';
import { NAME_STYLES } from '@/components/nameStyles';
import { SEAT_ANIMATIONS } from '@/components/seatAnimations';
import { SEAT_FLAIRS } from '@/components/seatFlairs';
import { getAnimationOption } from '@/components/SettingsSheet/animationOptions';
import { compareByRarity } from '@/config/rarityVisual';
import { AVATAR_KEYS } from '@/utils/avatar';

import {
  type AvatarCellItem,
  type EffectGridItem,
  type FlairGridItem,
  type FrameGridItem,
  type NameStyleGridItem,
  NUM_COLUMNS,
  type RarityFilter,
  type SeatAnimationGridItem,
} from './types';

export function buildAvatarGridData(
  unlockedAvatars: ReadonlySet<string>,
  readOnly: boolean,
  customAvatarUrl: string | null | undefined,
): AvatarCellItem[] {
  const specials: AvatarCellItem[] = readOnly ? [] : [{ key: 'special-default', type: 'default' }];
  if (!readOnly && customAvatarUrl) {
    specials.push({ key: 'special-custom', type: 'custom' });
  }

  const avatars: AvatarCellItem[] = AVATAR_KEYS.map((avatarId) => ({
    key: avatarId,
    type: 'avatar' as const,
    avatarId,
  }));
  avatars.sort((a, b) => {
    if (a.type !== 'avatar' || b.type !== 'avatar') return 0;
    const aUnlocked = unlockedAvatars.has(a.avatarId);
    const bUnlocked = unlockedAvatars.has(b.avatarId);
    return (
      Number(!aUnlocked) - Number(!bUnlocked) ||
      compareByRarity(getItemRarity(a.avatarId), getItemRarity(b.avatarId))
    );
  });

  const items = [...specials, ...avatars];
  const remainder = items.length % NUM_COLUMNS;
  if (remainder !== 0) {
    for (let i = 0; i < NUM_COLUMNS - remainder; i++) {
      items.push({ key: `placeholder-${i}`, type: 'placeholder' });
    }
  }
  return items;
}

export function buildFrameGridData(
  unlockedIds: readonly string[],
  currentFrameId: string | null,
  isNoFrameActive: boolean,
): FrameGridItem[] {
  const none: FrameGridItem = {
    id: 'none',
    name: '无',
    unlocked: true,
    isActive: isNoFrameActive,
    rarity: null,
  };
  const items: FrameGridItem[] = AVATAR_FRAMES.map((f) => ({
    id: f.id,
    name: f.name,
    unlocked: isFrameUnlocked(f.id, unlockedIds),
    isActive: currentFrameId === f.id,
    rarity: getItemRarity(f.id),
  }));
  items.sort(
    (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
  );
  return [none, ...items];
}

export function buildFlairGridData(
  unlockedIds: readonly string[],
  currentFlairId: string | null,
  isNoFlairActive: boolean,
): FlairGridItem[] {
  const none: FlairGridItem = {
    id: 'none',
    name: '无',
    unlocked: true,
    isActive: isNoFlairActive,
    rarity: null,
  };
  const items: FlairGridItem[] = SEAT_FLAIRS.map((f) => ({
    id: f.id,
    name: f.name,
    unlocked: isFlairUnlocked(f.id, unlockedIds),
    isActive: currentFlairId === f.id,
    rarity: getItemRarity(f.id),
  }));
  items.sort(
    (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
  );
  return [none, ...items];
}

export function buildNameStyleGridData(
  unlockedIds: readonly string[],
  currentNameStyleId: string | null,
  isNoNameStyleActive: boolean,
): NameStyleGridItem[] {
  const none: NameStyleGridItem = {
    id: 'none',
    name: '无',
    unlocked: true,
    isActive: isNoNameStyleActive,
    rarity: null,
  };
  const items: NameStyleGridItem[] = NAME_STYLES.map((s) => ({
    id: s.id,
    name: s.name,
    unlocked: isNameStyleUnlocked(s.id, unlockedIds),
    isActive: currentNameStyleId === s.id,
    rarity: getItemRarity(s.id),
  }));
  items.sort(
    (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
  );
  return [none, ...items];
}

export function buildEffectGridData(
  unlockedIds: readonly string[],
  currentEquippedEffect: string | null,
  isNoEffectActive: boolean,
  isRandomEffectActive: boolean,
): EffectGridItem[] {
  const none: EffectGridItem = {
    id: 'none',
    name: '无',
    icon: 'close-circle-outline',
    unlocked: true,
    isActive: isNoEffectActive,
    rarity: null,
  };
  const random: EffectGridItem = {
    id: 'random',
    name: '随机',
    icon: 'shuffle-outline',
    unlocked: true,
    isActive: isRandomEffectActive,
    rarity: null,
  };
  const items: EffectGridItem[] = ROLE_REVEAL_EFFECT_IDS.map((id) => {
    const opt = getAnimationOption(id);
    return {
      id,
      name: opt?.label ?? id,
      icon: opt?.icon ?? 'help-outline',
      unlocked: isRoleRevealEffectUnlocked(id, unlockedIds),
      isActive: currentEquippedEffect === id,
      rarity: getItemRarity(id),
    };
  });
  items.sort(
    (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
  );
  return [none, random, ...items];
}

export function filterAvatarGridData(
  data: AvatarCellItem[],
  rarityFilter: RarityFilter,
): AvatarCellItem[] {
  if (rarityFilter === 'all') return data;
  const filtered = data.filter(
    (item) => item.type === 'avatar' && getItemRarity(item.avatarId) === rarityFilter,
  );
  const remainder = filtered.length % NUM_COLUMNS;
  if (remainder !== 0) {
    for (let i = 0; i < NUM_COLUMNS - remainder; i++) {
      filtered.push({ key: `filter-placeholder-${i}`, type: 'placeholder' });
    }
  }
  return filtered;
}

export function buildSeatAnimationGridData(
  unlockedIds: readonly string[],
  currentSeatAnimationId: string | null,
  isNoSeatAnimationActive: boolean,
): SeatAnimationGridItem[] {
  const none: SeatAnimationGridItem = {
    id: 'none',
    name: '无',
    unlocked: true,
    isActive: isNoSeatAnimationActive,
    rarity: null,
  };
  const items: SeatAnimationGridItem[] = SEAT_ANIMATIONS.map((a) => ({
    id: a.id,
    name: a.name,
    unlocked: isSeatAnimationUnlocked(a.id, unlockedIds),
    isActive: currentSeatAnimationId === a.id,
    rarity: getItemRarity(a.id),
  }));
  items.sort(
    (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
  );
  return [none, ...items];
}

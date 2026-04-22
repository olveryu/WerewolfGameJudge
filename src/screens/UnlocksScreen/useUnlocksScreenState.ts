/**
 * useUnlocksScreenState — UnlocksScreen 的状态 hook
 *
 * 数据获取（self / other user unlocks）、tab/filter 切换、
 * item 列表计算、进度统计。
 */
import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  getItemRarity,
  NAME_STYLE_IDS,
  type Rarity,
  SEAT_FLAIR_IDS,
} from '@werewolf/game-engine/growth/rewardCatalog';
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import { useCallback, useMemo, useState } from 'react';

import { AVATAR_FRAMES } from '@/components/avatarFrames';
import { NAME_STYLES } from '@/components/nameStyles';
import { SEAT_FLAIRS } from '@/components/seatFlairs';
import { compareByRarity } from '@/config/rarityVisual';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { useUserUnlocksQuery } from '@/hooks/queries/useUserUnlocksQuery';

export const NUM_COLUMNS = 4;

export type TabKey = 'avatar' | 'frame' | 'flair' | 'nameStyle';

export const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'avatar', label: '头像' },
  { key: 'frame', label: '头像框' },
  { key: 'flair', label: '特效' },
  { key: 'nameStyle', label: '名字' },
] as const;

export type RarityFilter = 'all' | Rarity;

export interface UnlockItem {
  id: string;
  type: TabKey;
  displayName: string;
  unlocked: boolean;
  rarity: Rarity;
}

interface Params {
  viewingUserId: string | undefined;
}

export function useUnlocksScreenState({ viewingUserId }: Params) {
  const isViewer = !!viewingUserId;

  const [activeTab, setActiveTab] = useState<TabKey>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');

  // Fetch unlocked items: self → useUserStatsQuery, other → useUserUnlocksQuery
  const selfStats = useUserStatsQuery({ enabled: !isViewer });
  const otherUnlocks = useUserUnlocksQuery(viewingUserId ?? '');
  const unlockedItems = isViewer
    ? (otherUnlocks.data ?? null)
    : (selfStats.data?.unlockedItems ?? null);
  const loading = isViewer ? otherUnlocks.isLoading : selfStats.isLoading;

  const unlockedSet = useMemo(
    () =>
      new Set([
        ...Array.from(FREE_AVATAR_IDS),
        ...Array.from(FREE_FRAME_IDS),
        ...(unlockedItems ?? []),
      ]),
    [unlockedItems],
  );

  const avatarItems = useMemo(
    (): UnlockItem[] =>
      AVATAR_IDS.map((id) => ({
        id,
        type: 'avatar' as const,
        displayName: getRoleDisplayName(id),
        unlocked: unlockedSet.has(id),
        rarity: getItemRarity(id),
      })).sort(
        (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
      ),
    [unlockedSet],
  );

  const frameItems = useMemo((): UnlockItem[] => {
    return FRAME_IDS.map((id) => {
      const frame = AVATAR_FRAMES.find((f) => f.id === id);
      return {
        id,
        type: 'frame' as const,
        displayName: frame?.name ?? id,
        unlocked: unlockedSet.has(id),
        rarity: getItemRarity(id),
      };
    }).sort(
      (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
    );
  }, [unlockedSet]);

  const flairItems = useMemo(
    (): UnlockItem[] =>
      SEAT_FLAIR_IDS.map((id) => {
        const flair = SEAT_FLAIRS.find((f) => f.id === id);
        return {
          id,
          type: 'flair' as const,
          displayName: flair?.name ?? id,
          unlocked: unlockedSet.has(id),
          rarity: getItemRarity(id),
        };
      }).sort(
        (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
      ),
    [unlockedSet],
  );

  const nameStyleItems = useMemo(
    (): UnlockItem[] =>
      NAME_STYLE_IDS.map((id) => {
        const ns = NAME_STYLES.find((s) => s.id === id);
        return {
          id,
          type: 'nameStyle' as const,
          displayName: ns?.name ?? id,
          unlocked: unlockedSet.has(id),
          rarity: getItemRarity(id),
        };
      }).sort(
        (a, b) => Number(!a.unlocked) - Number(!b.unlocked) || compareByRarity(a.rarity, b.rarity),
      ),
    [unlockedSet],
  );

  const allTabItems =
    activeTab === 'avatar'
      ? avatarItems
      : activeTab === 'frame'
        ? frameItems
        : activeTab === 'flair'
          ? flairItems
          : nameStyleItems;

  // Apply rarity sub-tab filter
  const currentItems = useMemo(
    () =>
      rarityFilter === 'all' ? allTabItems : allTabItems.filter((i) => i.rarity === rarityFilter),
    [allTabItems, rarityFilter],
  );

  // Pad last row with invisible spacers so flex:1 cells don't stretch
  const paddedItems = useMemo(() => {
    const remainder = currentItems.length % NUM_COLUMNS;
    if (remainder === 0) return currentItems;
    const spacers: UnlockItem[] = Array.from({ length: NUM_COLUMNS - remainder }, (_, i) => ({
      id: `__spacer_${i}`,
      type: activeTab,
      displayName: '',
      unlocked: false,
      rarity: 'common',
    }));
    return [...currentItems, ...spacers];
  }, [currentItems, activeTab]);

  const unlockedCount = allTabItems.filter((i) => i.unlocked).length;
  const totalCount = allTabItems.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setRarityFilter('all');
  }, []);

  return {
    activeTab,
    rarityFilter,
    setRarityFilter,
    loading,
    isViewer,
    paddedItems,
    unlockedCount,
    totalCount,
    progressPercent,
    handleTabChange,
  };
}

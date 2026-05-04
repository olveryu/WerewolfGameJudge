/**
 * ShardExchangeScreen — 碎片兑换商店
 *
 * 按物品类型 tab 浏览全部可兑换物品，碎片换指定物品。
 * 已拥有物品灰显 + "已拥有"标签，碎片不够的禁用兑换按钮。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import type { Rarity, RewardType } from '@werewolf/game-engine/growth/rewardCatalog';
import { REWARD_POOL, SHARD_COSTS } from '@werewolf/game-engine/growth/rewardCatalog';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import { useExchangeShardMutation, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, fixed, shadows, spacing, typography, withAlpha } from '@/theme';
import { gachaLog } from '@/utils/logger';

import { getRewardDisplayName, RewardPreview } from '../GachaScreen/components/RewardPreview';

type Props = NativeStackScreenProps<RootStackParamList, 'ShardExchange'>;

// ── Types ───────────────────────────────────────────────────────────────

interface ExchangeItem {
  type: RewardType;
  id: string;
  rarity: Rarity;
  cost: number;
  isOwned: boolean;
}

type TypeTab =
  | 'avatar'
  | 'frame'
  | 'seatFlair'
  | 'nameStyle'
  | 'seatAnimation'
  | 'roleRevealEffect';

const TABS: readonly { key: TypeTab; label: string }[] = [
  { key: 'avatar', label: '头像' },
  { key: 'frame', label: '头像框' },
  { key: 'seatFlair', label: '座位' },
  { key: 'nameStyle', label: '名字' },
  { key: 'seatAnimation', label: '动画' },
  { key: 'roleRevealEffect', label: '特效' },
];

type RarityFilter = 'all' | Rarity;

const RARITY_FILTERS: readonly { key: RarityFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'legendary', label: '传说' },
  { key: 'epic', label: '史诗' },
  { key: 'rare', label: '稀有' },
  { key: 'common', label: '普通' },
];

function getNumColumns(screenWidth: number): number {
  if (screenWidth >= 768) return 5;
  if (screenWidth >= 600) return 4;
  return 3;
}

const PREVIEW_SIZE = 56;

// ── Component ───────────────────────────────────────────────────────────

export function ShardExchangeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = getNumColumns(screenWidth);
  const { data: gachaStatus, isLoading: gachaLoading } = useGachaStatusQuery();
  const { data: statsData, isLoading: statsLoading } = useUserStatsQuery();
  const { mutate: exchange, isPending: isExchanging } = useExchangeShardMutation();

  const [activeTab, setActiveTab] = useState<TypeTab>('avatar');
  const [activeRarity, setActiveRarity] = useState<RarityFilter>('all');

  const shards = gachaStatus?.shards ?? 0;
  const unlockedSet = useMemo(
    () => new Set(statsData?.unlockedItems ?? []),
    [statsData?.unlockedItems],
  );

  const items = useMemo((): ExchangeItem[] => {
    return REWARD_POOL.filter(
      (item) => item.type === activeTab && (activeRarity === 'all' || item.rarity === activeRarity),
    )
      .map((item) => ({
        type: item.type,
        id: item.id,
        rarity: item.rarity,
        cost: SHARD_COSTS[item.rarity],
        isOwned: unlockedSet.has(item.id),
      }))
      .sort((a, b) => {
        // Owned items last, then by rarity (legendary first), then by id
        if (a.isOwned !== b.isOwned) return a.isOwned ? 1 : -1;
        return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      });
  }, [activeTab, activeRarity, unlockedSet]);

  // Pad items to fill last row
  const paddedItems = useMemo(() => {
    const remainder = items.length % numColumns;
    if (remainder === 0) return items;
    const spacers: ExchangeItem[] = Array.from({ length: numColumns - remainder }, (_, i) => ({
      type: activeTab,
      id: `__spacer_${i}`,
      rarity: 'common' as Rarity,
      cost: 0,
      isOwned: false,
    }));
    return [...items, ...spacers];
  }, [items, activeTab, numColumns]);

  const handleExchange = useCallback(
    (item: ExchangeItem) => {
      const displayName = getRewardDisplayName(item.type, item.id);
      Alert.alert('确认兑换', `消耗 ✦ ${item.cost} 碎片兑换「${displayName}」？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '兑换',
          onPress: () => {
            exchange(item.id, {
              onSuccess: () => {
                toast.success('兑换成功', { description: `获得「${displayName}」` });
              },
              onError: (error: Error) => {
                const isExpected =
                  error.message.includes('碎片不足') || error.message.includes('已拥有');
                if (!isExpected) {
                  gachaLog.error('Exchange failed', { rewardId: item.id, error });
                  Sentry.captureException(error);
                }
                toast.error(error.message || '兑换失败，请稍后重试');
              },
            });
          },
        },
      ]);
    },
    [exchange],
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Gacha');
    }
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ExchangeItem>) => {
      if (item.id.startsWith('__spacer_')) return <View style={styles.cell} />;

      const visual = RARITY_VISUAL[item.rarity];
      const canAfford = shards >= item.cost;
      const disabled = item.isOwned || !canAfford || isExchanging;

      return (
        <View
          style={[
            styles.cell,
            { borderColor: item.isOwned ? colors.border : withAlpha(visual.color, 0.4) },
            item.isOwned && styles.cellOwned,
          ]}
        >
          {/* Rarity dot */}
          <View style={[styles.rarityDot, { backgroundColor: visual.color }]} />

          {/* Preview */}
          <View style={item.isOwned ? styles.previewDimmed : undefined}>
            <RewardPreview rewardType={item.type} rewardId={item.id} size={PREVIEW_SIZE} />
          </View>

          {/* Name */}
          <Text style={styles.cellName} numberOfLines={1}>
            {getRewardDisplayName(item.type, item.id)}
          </Text>

          {/* Status / Exchange */}
          {item.isOwned ? (
            <View style={styles.ownedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.ownedText}>已拥有</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.exchangeButton, disabled && styles.exchangeButtonDisabled]}
              onPress={() => handleExchange(item)}
              disabled={disabled}
            >
              <Text
                style={[styles.exchangeButtonText, disabled && styles.exchangeButtonTextDisabled]}
              >
                ✦ {item.cost}
              </Text>
            </Pressable>
          )}

          {/* Deficit hint */}
          {!item.isOwned && !canAfford && (
            <Text style={styles.deficitText}>差 {item.cost - shards}</Text>
          )}
        </View>
      );
    },
    [shards, isExchanging, handleExchange],
  );

  const keyExtractor = useCallback((item: ExchangeItem) => `${item.type}-${item.id}`, []);

  const isLoading = gachaLoading || statsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="碎片兑换"
        onBack={handleGoBack}
        topInset={insets.top}
        headerRight={
          <View style={styles.shardBadge}>
            <Ionicons name="diamond-outline" size={14} color={colors.warning} />
            <Text style={styles.shardCount}>{shards.toLocaleString()}</Text>
          </View>
        }
      />

      {/* Type tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Rarity filter chips */}
      <View style={styles.rarityBar}>
        {RARITY_FILTERS.map((rf) => {
          const isActive = activeRarity === rf.key;
          const chipColor = rf.key === 'all' ? colors.primary : RARITY_VISUAL[rf.key].color;
          return (
            <Pressable
              key={rf.key}
              style={[
                styles.rarityChip,
                isActive && { backgroundColor: withAlpha(chipColor, 0.15) },
              ]}
              onPress={() => setActiveRarity(rf.key)}
            >
              {rf.key !== 'all' && (
                <View
                  style={[styles.rarityChipDot, { backgroundColor: RARITY_VISUAL[rf.key].color }]}
                />
              )}
              <Text
                style={[
                  styles.rarityChipText,
                  isActive && { color: chipColor, fontWeight: typography.weights.semibold },
                ]}
              >
                {rf.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Item grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={paddedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing.large) },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header shard badge ──
  shardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    backgroundColor: withAlpha(colors.warning, 0.12),
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
  },
  shardCount: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
    fontVariant: ['tabular-nums'],
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenH,
    gap: spacing.tight,
    paddingVertical: spacing.small,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.small,
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
  },

  // ── Rarity filter chips ──
  rarityBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenH,
    gap: spacing.tight,
    paddingBottom: spacing.small,
  },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  rarityChipDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  rarityChipText: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
  },

  // ── Grid ──
  listContent: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.small,
    gap: spacing.small,
  },
  row: {
    gap: spacing.small,
  },

  // ── Cell ──
  cell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.tight,
    alignItems: 'center',
    gap: spacing.micro,
    ...shadows.sm,
  },
  cellOwned: {
    opacity: 0.5,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  previewDimmed: {
    opacity: 0.4,
  },
  cellName: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },

  // ── Owned badge ──
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ownedText: {
    fontSize: typography.captionSmall,
    color: colors.success,
  },

  // ── Exchange button ──
  exchangeButton: {
    backgroundColor: withAlpha(colors.warning, 0.12),
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.small,
  },
  exchangeButtonDisabled: {
    opacity: 0.4,
  },
  exchangeButtonText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.warning,
  },
  exchangeButtonTextDisabled: {
    color: colors.textMuted,
  },

  // ── Deficit ──
  deficitText: {
    fontSize: typography.captionSmall,
    color: colors.error,
  },
});

/**
 * UnlocksScreen — 解锁物品一览
 *
 * 顶部 tab 切换"头像"/"头像框"/"特效"/"名字"，summary card 显示当前 tab 进度。
 * 已解锁 cell 高亮 + 绿色对勾角标，未解锁灰暗 + 锁标。
 */
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import { type RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, shadows, spacing, textStyles, typography, withAlpha } from '@/theme';

import { UnlockCell } from './UnlockCell';
import {
  type RarityFilter,
  TABS,
  type UnlockItem,
  useUnlocksScreenState,
} from './useUnlocksScreenState';

const RARITY_TABS: readonly { key: RarityFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  ...RARITY_ORDER.map((r) => ({ key: r as RarityFilter, label: RARITY_VISUAL[r].label })),
] as const;

export const UnlocksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Unlocks'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Unlocks'>>();
  const viewingUserId = route.params?.userId;
  const viewingDisplayName = route.params?.displayName;

  const {
    activeTab,
    rarityFilter,
    setRarityFilter,
    loading,
    isViewer,
    paddedItems,
    numColumns,
    unlockedCount,
    totalCount,
    progressPercent,
    handleTabChange,
  } = useUnlocksScreenState({ viewingUserId });

  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UnlockItem>) =>
      item.id.startsWith('__spacer_') ? <View style={styles.cell} /> : <UnlockCell item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: UnlockItem) => `${item.type}-${item.id}`, []);

  const listHeader = useMemo(
    () => (
      <>
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.progressRing}>
            <View style={styles.progressRingInner}>
              <Text style={styles.progressNumber}>{unlockedCount}</Text>
              <Text style={styles.progressDenom}>/{totalCount}</Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryTitle}>{isViewer ? 'TA的收藏' : '收藏进度'}</Text>
            <View style={styles.summaryBarBg}>
              <View style={[styles.summaryBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.summarySubtitle}>
              {isViewer
                ? `已收集 ${progressPercent}%`
                : `已收集 ${progressPercent}%，继续游玩解锁更多`}
            </Text>
          </View>
        </View>

        {/* Type tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => handleTabChange(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Rarity sub-tab bar */}
        <View style={styles.rarityTabBar}>
          {RARITY_TABS.map((rt) => {
            const isActive = rt.key === rarityFilter;
            const visual = rt.key !== 'all' ? RARITY_VISUAL[rt.key] : null;
            const activeColor = visual?.color ?? colors.primary;
            const activeShadow =
              visual?.chipShadow ?? `0px 2px 8px ${withAlpha(colors.primary, 0.3)}`;
            return (
              <Pressable
                key={rt.key}
                style={[
                  styles.rarityTab,
                  isActive && {
                    backgroundColor: activeColor,
                    boxShadow: activeShadow,
                  },
                ]}
                onPress={() => setRarityFilter(rt.key)}
              >
                <Text style={[styles.rarityTabText, isActive && styles.rarityTabTextActive]}>
                  {rt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    ),
    [
      unlockedCount,
      totalCount,
      progressPercent,
      activeTab,
      rarityFilter,
      isViewer,
      handleTabChange,
      setRarityFilter,
    ],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title={isViewer ? `${viewingDisplayName ?? 'TA'}的收藏` : '解锁一览'}
        onBack={handleGoBack}
        topInset={insets.top}
      />

      {loading ? (
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
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            insets.bottom > 0 && { paddingBottom: spacing.xxlarge + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────

const PROGRESS_RING_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.transparent,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.screenH,
    paddingBottom: spacing.xxlarge,
  },

  // Spacer cell
  cell: {
    flex: 1,
    alignItems: 'center',
    marginBottom: spacing.medium,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    marginBottom: spacing.large,
    gap: spacing.medium,
    ...shadows.md,
  },
  progressRing: {
    width: PROGRESS_RING_SIZE,
    height: PROGRESS_RING_SIZE,
    borderRadius: PROGRESS_RING_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.primary, 0.06),
  },
  progressRingInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  progressNumber: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  progressDenom: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  summaryRight: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  summaryBarBg: {
    height: 10,
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.tight,
  },
  summaryBarFill: {
    height: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
  },
  summarySubtitle: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.tight,
    marginBottom: spacing.medium,
    gap: spacing.tight,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
  },

  // Rarity sub-tab bar
  rarityTabBar: {
    flexDirection: 'row',
    marginBottom: spacing.medium,
    gap: spacing.tight,
  },
  rarityTab: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.full,
  },
  rarityTabText: {
    ...textStyles.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  rarityTabTextActive: {
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
  },
});

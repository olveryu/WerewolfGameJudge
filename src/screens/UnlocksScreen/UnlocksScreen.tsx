/**
 * UnlocksScreen — 解锁物品一览
 *
 * 顶部 tab 切换"头像"/"头像框"，summary card 显示当前 tab 进度。
 * 已解锁 cell 高亮 + 绿色对勾角标，未解锁灰暗 + 锁标。
 */
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  NAME_STYLE_IDS,
  SEAT_FLAIR_IDS,
} from '@werewolf/game-engine/growth/rewardCatalog';
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AVATAR_FRAMES, type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { Button } from '@/components/Button';
import { NAME_STYLES, NameStyleText } from '@/components/nameStyles';
import { SEAT_FLAIRS } from '@/components/seatFlairs';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { useUserUnlocksQuery } from '@/hooks/queries/useUserUnlocksQuery';
import { RootStackParamList } from '@/navigation/types';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/theme';
import { AVATAR_KEYS, getAvatarThumbByIndex } from '@/utils/avatar';

const NUM_COLUMNS = 4;
const CELL_SIZE = 80;

type TabKey = 'avatar' | 'frame' | 'flair' | 'nameStyle';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'avatar', label: '头像' },
  { key: 'frame', label: '头像框' },
  { key: 'flair', label: '特效' },
  { key: 'nameStyle', label: '名字' },
] as const;

interface UnlockItem {
  id: string;
  type: TabKey;
  displayName: string;
  unlocked: boolean;
}

export const UnlocksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Unlocks'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Unlocks'>>();
  const viewingUserId = route.params?.userId;
  const viewingDisplayName = route.params?.displayName;
  const isViewer = !!viewingUserId;

  const [activeTab, setActiveTab] = useState<TabKey>('avatar');

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
      })).sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
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
      };
    }).sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
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
        };
      }).sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
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
        };
      }).sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
    [unlockedSet],
  );

  const currentItems =
    activeTab === 'avatar'
      ? avatarItems
      : activeTab === 'frame'
        ? frameItems
        : activeTab === 'flair'
          ? flairItems
          : nameStyleItems;
  const unlockedCount = currentItems.filter((i) => i.unlocked).length;
  const totalCount = currentItems.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UnlockItem>) => <UnlockCell item={item} />,
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

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
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
      </>
    ),
    [unlockedCount, totalCount, progressPercent, activeTab, isViewer],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>
          {isViewer ? `${viewingDisplayName ?? 'TA'}的收藏` : '解锁一览'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
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

// ── Cell component ──────────────────────────────────────

const UnlockCell = React.memo<{ item: UnlockItem }>(({ item }) => {
  const thumb =
    item.type === 'avatar' ? (
      <AvatarThumb id={item.id} unlocked={item.unlocked} />
    ) : item.type === 'frame' ? (
      <FrameThumb id={item.id} unlocked={item.unlocked} />
    ) : item.type === 'nameStyle' ? (
      <NameStyleThumb id={item.id} unlocked={item.unlocked} displayName={item.displayName} />
    ) : (
      <FlairThumb id={item.id} unlocked={item.unlocked} />
    );

  // nameStyle cells: show the name with the effect applied as the label
  const label =
    item.type === 'nameStyle' && item.unlocked ? (
      <NameStyleText styleId={item.id} style={styles.cellName} numberOfLines={1}>
        {item.displayName}
      </NameStyleText>
    ) : (
      <Text style={[styles.cellName, !item.unlocked && styles.lockedText]} numberOfLines={1}>
        {item.unlocked ? item.displayName : '???'}
      </Text>
    );

  return (
    <View style={styles.cell}>
      <View style={[styles.imageWrapper, item.unlocked ? styles.unlockedBorder : styles.lockedBg]}>
        {thumb}
        {/* Badge overlay */}
        {item.unlocked ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color={colors.textInverse} />
          </View>
        ) : (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={10} color={colors.textInverse} />
          </View>
        )}
      </View>
      {label}
    </View>
  );
});

UnlockCell.displayName = 'UnlockCell';

const AvatarThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => {
  const avatarIndex = (AVATAR_KEYS as readonly string[]).indexOf(id);
  const thumbSource = avatarIndex >= 0 ? getAvatarThumbByIndex(avatarIndex) : undefined;

  if (thumbSource == null) return null;

  return (
    <Image
      source={thumbSource as ImageSourcePropType}
      style={[styles.avatarImage, !unlocked && styles.grayscale]}
      resizeMode="cover"
    />
  );
});

AvatarThumb.displayName = 'AvatarThumb';

const FrameThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => (
  <View style={!unlocked ? styles.grayscale : undefined}>
    <AvatarWithFrame
      value="preview"
      avatarUrl={null}
      frameId={id as FrameId}
      size={CELL_SIZE - spacing.small * 2}
    />
  </View>
));

FrameThumb.displayName = 'FrameThumb';

const FLAIR_PREVIEW_SIZE = CELL_SIZE - spacing.small * 2;

const FlairThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => {
  const flair = SEAT_FLAIRS.find((f) => f.id === id);
  if (!flair) return null;
  const Comp = flair.Component;
  return (
    <View
      style={[
        { width: FLAIR_PREVIEW_SIZE, height: FLAIR_PREVIEW_SIZE },
        !unlocked && styles.grayscale,
      ]}
    >
      <Comp size={FLAIR_PREVIEW_SIZE} borderRadius={borderRadius.medium} />
    </View>
  );
});

FlairThumb.displayName = 'FlairThumb';

const NAME_STYLE_PREVIEW_SIZE = CELL_SIZE - spacing.small * 2;

const NameStyleThumb = React.memo<{ id: string; unlocked: boolean; displayName: string }>(
  ({ id, unlocked, displayName }) => {
    return (
      <View
        style={[
          styles.nameStylePreview,
          { width: NAME_STYLE_PREVIEW_SIZE, height: NAME_STYLE_PREVIEW_SIZE },
          !unlocked && styles.grayscale,
        ]}
      >
        <NameStyleText styleId={unlocked ? id : undefined} style={styles.nameStylePreviewText}>
          {unlocked ? displayName : '???'}
        </NameStyleText>
      </View>
    );
  },
);

NameStyleThumb.displayName = 'NameStyleThumb';

// ── Styles ──────────────────────────────────────────────

const PROGRESS_RING_SIZE = 64;
const CHECK_BADGE_SIZE = 18;
const LOCK_BADGE_SIZE = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.transparent,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingVertical: layout.headerPaddingV,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: layout.headerTitleSize,
    lineHeight: layout.headerTitleLineHeight,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
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

  // Grid
  cell: {
    flex: 1,
    alignItems: 'center',
    marginBottom: spacing.medium,
    maxWidth: `${100 / NUM_COLUMNS}%`,
  },
  imageWrapper: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: withAlpha(colors.border, 0),
  },
  unlockedBorder: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  lockedBg: {
    backgroundColor: withAlpha(colors.border, 0.3),
    opacity: 0.5,
  },
  avatarImage: {
    width: CELL_SIZE - 4, // account for border
    height: CELL_SIZE - 4,
  },
  grayscale: {
    opacity: 0.4,
  },
  nameStylePreview: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  nameStylePreviewText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.medium,
  },

  // Badges
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: CHECK_BADGE_SIZE,
    height: CHECK_BADGE_SIZE,
    borderRadius: CHECK_BADGE_SIZE / 2,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: LOCK_BADGE_SIZE,
    height: LOCK_BADGE_SIZE,
    borderRadius: LOCK_BADGE_SIZE / 2,
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cell text
  cellName: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.caption,
    color: colors.text,
    marginTop: spacing.tight,
    textAlign: 'center',
  },
  lockedText: {
    color: colors.textMuted,
  },
});

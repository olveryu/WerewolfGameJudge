/**
 * TenResultOverlay — 10 连抽结果全屏面板
 *
 * 5×2 网格，按稀有度排序，卡片 100ms 间隔逐张飞入。
 * 与 gacha-capsule-v5.html 的 tenResultOverlay 对齐。
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/services/feature/GachaService';
import { borderRadius, colors, fixed, shadows, spacing, typography, withAlpha } from '@/theme';

import { getRewardDisplayName, RewardPreview } from './RewardPreview';

interface TenResultOverlayProps {
  results: DrawResultItem[];
  drawType: 'normal' | 'golden';
  onClose: () => void;
}

const PREVIEW_SIZE_TEN = 48;

const GROUP_DOT_SIZE = 8;

// ─── Single result cell with staggered entrance ─────────────────────────

function ResultCell({ item, index }: { item: DrawResultItem; index: number }) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      80 + index * 100,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.4)) }),
    );
    opacity.value = withDelay(80 + index * 100, withTiming(1, { duration: 250 }));
  }, [index, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const visual = RARITY_VISUAL[item.rarity] ?? RARITY_VISUAL.common;
  const displayName = getRewardDisplayName(item.rewardType, item.rewardId);
  const isHighRarity = item.rarity === 'legendary' || item.rarity === 'epic';

  return (
    <Animated.View
      style={[
        styles.cell,
        isHighRarity && {
          borderColor: withAlpha(visual.color, 0.4),
          backgroundColor: withAlpha(visual.color, 0.08),
        },
        animStyle,
      ]}
    >
      {item.pityTriggered && <Text style={[styles.pityTag, { color: visual.color }]}>保底</Text>}
      <View style={styles.cellPreview}>
        <RewardPreview
          rewardType={item.rewardType}
          rewardId={item.rewardId}
          size={PREVIEW_SIZE_TEN}
        />
      </View>
      <Text style={styles.cellName} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={[styles.cellRarity, { color: visual.color }]}>{visual.label}</Text>
      {item.isNew && <Text style={styles.cellNew}>NEW</Text>}
    </Animated.View>
  );
}

// ─── Overlay ────────────────────────────────────────────────────────────

interface RarityGroup {
  rarity: (typeof RARITY_ORDER)[number];
  items: DrawResultItem[];
  startIndex: number;
}

export function TenResultOverlay({ results, drawType, onClose }: TenResultOverlayProps) {
  const groups = useMemo((): RarityGroup[] => {
    const withItems = RARITY_ORDER.map((rarity) => ({
      rarity,
      items: results.filter((r) => r.rarity === rarity),
    })).filter((g) => g.items.length > 0);
    return withItems.map((g, i) => ({
      ...g,
      startIndex: withItems.slice(0, i).reduce((sum, prev) => sum + prev.items.length, 0),
    }));
  }, [results]);

  return (
    <View style={styles.overlay}>
      <View style={styles.titleRow}>
        <Ionicons
          name={drawType === 'golden' ? 'star' : 'sparkles'}
          size={20}
          color={drawType === 'golden' ? '#FFD700' : colors.primary}
        />
        <Text style={styles.title}>{drawType === 'golden' ? '黄金10连抽结果' : '10连抽结果'}</Text>
      </View>
      <View style={styles.gridContainer}>
        {groups.map((group) => {
          const visual = RARITY_VISUAL[group.rarity];
          return (
            <View key={group.rarity}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: visual.color }]} />
                <Text style={[styles.groupLabel, { color: visual.color }]}>{visual.label}</Text>
                <Text style={styles.groupCount}>×{group.items.length}</Text>
              </View>
              <View style={styles.grid}>
                {group.items.map((item, i) => (
                  <ResultCell
                    key={`${item.rewardId}-${group.startIndex + i}`}
                    item={item}
                    index={group.startIndex + i}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>确认</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
    zIndex: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.surface,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.small,
  },
  gridContainer: {
    maxWidth: 380,
    width: '90%',
    gap: spacing.small,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.tight,
  },
  groupDot: {
    width: GROUP_DOT_SIZE,
    height: GROUP_DOT_SIZE,
    borderRadius: GROUP_DOT_SIZE / 2,
  },
  groupLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  groupCount: {
    fontSize: typography.captionSmall,
    color: withAlpha(colors.surface, 0.6),
  },
  cell: {
    width: '18%',
    minWidth: 64,
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.tight,
    alignItems: 'center',
    gap: 2,
    ...shadows.sm,
  },
  cellPreview: {
    marginBottom: 2,
  },
  cellName: {
    fontSize: typography.captionSmall,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  cellRarity: {
    fontSize: 9,
    opacity: 0.7,
  },
  cellNew: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.success,
  },
  pityTag: {
    fontSize: 8,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: spacing.small,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.xlarge,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.primary,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.surface,
  },
});

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

import type { DrawResultItem } from '@/services/feature/GachaService';
import { borderRadius, colors, fixed, shadows, spacing, typography, withAlpha } from '@/theme';

import { RARITY_VISUAL } from '../gachaConstants';
import { getRewardDisplayName, RewardPreview } from './RewardPreview';

interface TenResultOverlayProps {
  results: DrawResultItem[];
  drawType: 'normal' | 'golden';
  onClose: () => void;
}

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

const PREVIEW_SIZE_TEN = 48;

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

export function TenResultOverlay({ results, drawType, onClose }: TenResultOverlayProps) {
  const sorted = useMemo(
    () =>
      [...results].sort((a, b) => (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4)),
    [results],
  );

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
      <View style={styles.grid}>
        {sorted.map((item, i) => (
          <ResultCell key={`${item.rewardId}-${i}`} item={item} index={i} />
        ))}
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
    justifyContent: 'center',
    gap: spacing.small,
    maxWidth: 380,
    width: '90%',
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

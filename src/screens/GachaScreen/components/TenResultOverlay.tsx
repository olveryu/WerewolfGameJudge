/**
 * TenResultOverlay — 10 连抽结果全屏面板
 *
 * 5×2 网格，按稀有度排序（高→低），卡片 stagger 入场。
 * 高稀有度（epic/legendary）卡片有发光边框、放大、呼吸辉光。
 * Common/rare 先入场，epic/legendary 延迟亮起（建设期待）。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CloseButton } from '@/components/CloseButton';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/services/feature/GachaService';
import {
  borderRadius,
  colors,
  fixed,
  shadows,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { getRewardDisplayName, RewardPreview } from './RewardPreview';

interface TenResultOverlayProps {
  results: DrawResultItem[];
  drawType: 'normal' | 'golden';
  onClose: () => void;
  onGoEquip?: () => void;
}

const PREVIEW_SIZE_TEN = 48;
const GROUP_DOT_SIZE = 8;

// Base delay for low-rarity items; high-rarity items appear later
const LOW_RARITY_BASE_DELAY = 80;
const HIGH_RARITY_DELAY = 700;

// ─── Single result cell with staggered entrance ─────────────────────────

function ResultCell({
  item,
  index,
  isHighRarity,
}: {
  item: DrawResultItem;
  index: number;
  isHighRarity: boolean;
}) {
  const scale = useSharedValue(isHighRarity ? 0.5 : 0.7);
  const opacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);

  const baseDelay = isHighRarity ? HIGH_RARITY_DELAY : LOW_RARITY_BASE_DELAY + index * 100;

  useEffect(() => {
    if (isHighRarity) {
      // High rarity: bigger entrance + overshoot
      scale.value = withDelay(
        baseDelay,
        withSequence(
          withTiming(item.rarity === 'legendary' ? 1.1 : 1.05, {
            duration: 350,
            easing: Easing.out(Easing.back(1.6)),
          }),
          withTiming(item.rarity === 'legendary' ? 1.06 : 1.03, { duration: 150 }),
        ),
      );
      opacity.value = withDelay(baseDelay, withTiming(1, { duration: 300 }));

      // Breathing glow for legendary
      if (item.rarity === 'legendary') {
        glowPulse.value = withDelay(
          baseDelay + 400,
          withRepeat(withTiming(0.6, { duration: 1200 }), -1, true),
        );
      }
    } else {
      scale.value = withDelay(
        baseDelay,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.4)) }),
      );
      opacity.value = withDelay(baseDelay, withTiming(1, { duration: 250 }));
    }
  }, [index, scale, opacity, glowPulse, isHighRarity, baseDelay, item.rarity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const visual = RARITY_VISUAL[item.rarity];
  const displayName = getRewardDisplayName(item.rewardType, item.rewardId);

  return (
    <Animated.View
      style={[
        styles.cell,
        isHighRarity && {
          borderColor: withAlpha(visual.color, 0.5),
          backgroundColor: withAlpha(visual.color, 0.08),
          boxShadow: `0px 0px ${item.rarity === 'legendary' ? 16 : 10}px ${withAlpha(visual.color, 0.25)}`,
        },
        animStyle,
      ]}
    >
      {item.isPityTriggered && <Text style={[styles.pityTag, { color: visual.color }]}>保底</Text>}
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

export function TenResultOverlay({ results, drawType, onClose, onGoEquip }: TenResultOverlayProps) {
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <CloseButton onPress={onClose} variant="onOverlay" style={styles.closeButton} />
        <View style={styles.titleRow}>
          <Ionicons
            name={drawType === 'golden' ? 'star' : 'sparkles'}
            size={20}
            color={drawType === 'golden' ? '#FFD700' : colors.primary}
          />
          <Text style={styles.title}>
            {drawType === 'golden' ? '黄金10连抽结果' : '10连抽结果'}
          </Text>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => {
            const visual = RARITY_VISUAL[group.rarity];
            const isHighGroup = group.rarity === 'legendary' || group.rarity === 'epic';
            return (
              <View key={group.rarity}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupDot, { backgroundColor: visual.color }]} />
                  <Text style={[styles.groupLabel, { color: visual.color }]}>{visual.label}</Text>
                  <View
                    style={[
                      styles.groupCountBadge,
                      { backgroundColor: withAlpha(visual.color, 0.15) },
                    ]}
                  >
                    <Text style={[styles.groupCountText, { color: visual.color }]}>
                      ×{group.items.length}
                    </Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  {group.items.map((item, i) => (
                    <ResultCell
                      key={`${item.rewardId}-${group.startIndex + i}`}
                      item={item}
                      index={group.startIndex + i}
                      isHighRarity={isHighGroup}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
        {onGoEquip && (
          <View style={styles.bottomActions}>
            <Pressable style={styles.equipButton} onPress={onGoEquip}>
              <Text style={styles.equipButtonText}>去装扮</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingTop: spacing.large,
  },
  title: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  scrollView: {
    maxHeight: '70%',
    width: '90%',
    maxWidth: 380,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.small,
  },
  gridContainer: {
    gap: spacing.small,
    paddingBottom: spacing.medium,
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
  groupCountBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.tight + spacing.micro,
    paddingVertical: 1,
  },
  groupCountText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
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
    marginBottom: spacing.micro,
  },
  cellName: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  cellRarity: {
    fontSize: 9,
    opacity: 0.7,
  },
  cellNew: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  pityTag: {
    fontSize: 8,
    fontWeight: typography.weights.semibold,
  },
  bottomActions: {
    width: '90%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.large,
  },
  equipButton: {
    width: '100%',
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  equipButtonText: {
    ...textStyles.bodySemibold,
    color: colors.surface,
  },
  closeButton: {
    top: spacing.xlarge,
    right: spacing.screenH,
  },
});

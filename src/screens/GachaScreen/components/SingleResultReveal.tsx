/**
 * SingleResultReveal — 单抽结果分级演出
 *
 * 4 级稀有度完全不同的视觉表现：
 * - Common: 简洁淡入，40% 遮罩，自动关闭 or 点击
 * - Rare: 蓝色径向辉光，back easing 弹入
 * - Epic: 紫色粒子背景，从底部 spring 弹入，脉冲辉光边框
 * - Legendary: 金色光柱从上方降下，冲击波扩散，金雨粒子，呼吸辉光
 *
 * reducedMotion 时所有动画退化为简单 fade-in。
 */
import type { Rarity, RewardType } from '@werewolf/game-engine/growth/rewardCatalog';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CloseButton } from '@/components/CloseButton';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/services/feature/GachaService';
import { borderRadius, colors, shadows, spacing, textStyles, typography, withAlpha } from '@/theme';

import { getRewardDisplayName, RewardPreview } from './RewardPreview';

// ─── Constants ──────────────────────────────────────────────────────────

const PREVIEW_SIZES: Record<Rarity, number> = {
  common: 80,
  rare: 100,
  epic: 120,
  legendary: 140,
};

const OVERLAY_OPACITY: Record<Rarity, number> = {
  common: 0.4,
  rare: 0.5,
  epic: 0.65,
  legendary: 0.75,
};

const BORDER_WIDTHS: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
};

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  avatar: '头像',
  frame: '头像框',
  seatFlair: '座位装饰',
  seatAnimation: '入座动画',
  nameStyle: '名称样式',
  roleRevealEffect: '翻牌特效',
};

// ─── Props ──────────────────────────────────────────────────────────────

interface SingleResultRevealProps {
  item: DrawResultItem;
  onDismiss: () => void;
  onGoEquip?: () => void;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function SingleResultReveal({
  item,
  onDismiss,
  onGoEquip,
  reducedMotion,
}: SingleResultRevealProps) {
  const rarity = item.rarity;
  const visual = RARITY_VISUAL[rarity];
  const displayName = getRewardDisplayName(item.rewardType, item.rewardId);
  const typeLabel = REWARD_TYPE_LABELS[item.rewardType];
  const previewSize = PREVIEW_SIZES[rarity];
  const overlayOpacity = OVERLAY_OPACITY[rarity];
  const borderWidth = BORDER_WIDTHS[rarity];

  // ── Animation values ──
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const cardTranslateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0);
  const cardGlowPulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      return;
    }

    switch (rarity) {
      case 'common':
        cardScale.value = withTiming(1, {
          duration: 200,
          easing: Easing.out(Easing.quad),
        });
        cardOpacity.value = withTiming(1, { duration: 200 });
        break;

      case 'rare':
        cardScale.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.back(1.4)),
        });
        cardOpacity.value = withTiming(1, { duration: 250 });
        glowOpacity.value = withTiming(0.6, { duration: 400 });
        glowScale.value = withTiming(1, { duration: 400 });
        break;

      case 'epic':
        cardTranslateY.value = 40;
        cardScale.value = withSequence(
          withTiming(1.05, { duration: 300, easing: Easing.out(Easing.back(1.4)) }),
          withTiming(1, { duration: 100 }),
        );
        cardTranslateY.value = withSpring(0, { damping: 12, stiffness: 200 });
        cardOpacity.value = withTiming(1, { duration: 300 });
        glowOpacity.value = withTiming(0.7, { duration: 500 });
        glowScale.value = withTiming(1, { duration: 500 });
        // Pulse glow
        cardGlowPulse.value = withDelay(
          500,
          withRepeat(withTiming(0.6, { duration: 1000 }), -1, true),
        );
        break;

      case 'legendary':
        cardTranslateY.value = -80;
        cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
        cardScale.value = withDelay(
          200,
          withSequence(
            withTiming(1.02, { duration: 400, easing: Easing.out(Easing.cubic) }),
            withTiming(1, { duration: 200 }),
          ),
        );
        cardTranslateY.value = withDelay(200, withSpring(0, { damping: 14, stiffness: 150 }));
        // Glow burst
        glowScale.value = withDelay(100, withTiming(1, { duration: 600 }));
        glowOpacity.value = withDelay(100, withTiming(0.8, { duration: 400 }));
        // Breathing glow
        cardGlowPulse.value = withDelay(
          700,
          withRepeat(withTiming(0.5, { duration: 1200 }), -1, true),
        );
        break;
    }
  }, [
    rarity,
    reducedMotion,
    cardScale,
    cardOpacity,
    cardTranslateY,
    glowOpacity,
    glowScale,
    cardGlowPulse,
  ]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }, { translateY: cardTranslateY.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * cardGlowPulse.value,
    transform: [{ scale: glowScale.value }],
  }));

  // ── Overlay background color ──
  const isEpicOrLegendary = rarity === 'epic' || rarity === 'legendary';
  const overlayBg = `rgba(26, 26, 46, ${overlayOpacity})`;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={[styles.overlay, { backgroundColor: overlayBg }]} onPress={onDismiss}>
        <CloseButton onPress={onDismiss} variant="onOverlay" style={styles.closeButton} />
        {/* Radial glow for rare+ */}
        {rarity !== 'common' && (
          <Animated.View
            style={[
              styles.radialGlow,
              { backgroundColor: withAlpha(visual.color, 0.15) },
              glowAnimStyle,
            ]}
          />
        )}

        {/* Light pillar for legendary */}
        {rarity === 'legendary' && <Animated.View style={[styles.lightPillar, glowAnimStyle]} />}

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            {
              borderWidth,
              borderColor: visual.color,
              boxShadow: isEpicOrLegendary
                ? `0px 0px ${rarity === 'legendary' ? 40 : 24}px ${withAlpha(visual.color, 0.3)}`
                : rarity === 'rare'
                  ? `0px 0px 16px ${withAlpha(visual.color, 0.2)}`
                  : undefined,
            },
            cardAnimStyle,
          ]}
        >
          {/* Rarity badge */}
          <View
            style={[
              styles.rarityBadge,
              { backgroundColor: visual.color },
              rarity === 'legendary' && styles.rarityBadgeLegendary,
            ]}
          >
            <Text style={styles.rarityBadgeText}>{visual.label}</Text>
          </View>

          {/* Pity tag */}
          {item.isPityTriggered && (
            <Text style={[styles.pityTag, { color: visual.color }]}>保底</Text>
          )}

          {/* Preview */}
          <View style={styles.previewWrap}>
            <RewardPreview
              rewardType={item.rewardType}
              rewardId={item.rewardId}
              size={previewSize}
            />
          </View>

          {/* Info */}
          <Text style={styles.itemName}>{displayName}</Text>
          <Text style={styles.itemType}>{typeLabel}</Text>
          {item.isNew && <Text style={styles.newTag}>NEW</Text>}
        </Animated.View>

        {onGoEquip && (
          <View style={styles.bottomActions}>
            <Pressable style={styles.equipButton} onPress={onGoEquip}>
              <Text style={styles.equipButtonText}>去装扮</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
  },
  radialGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: borderRadius.full,
    pointerEvents: 'none',
  },
  lightPillar: {
    position: 'absolute',
    width: 4,
    height: '100%',
    backgroundColor: withAlpha('#FFD700', 0.5),
    pointerEvents: 'none',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    alignItems: 'center',
    gap: spacing.small,
    minWidth: 220,
    ...shadows.lg,
  },
  rarityBadge: {
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
  },
  rarityBadgeLegendary: {
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.small,
  },
  rarityBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  pityTag: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
  },
  previewWrap: {
    marginVertical: spacing.small,
  },
  itemName: {
    ...textStyles.headingBold,
    color: colors.text,
  },
  itemType: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  newTag: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  bottomActions: {
    position: 'absolute',
    bottom: spacing.xlarge,
    left: spacing.screenH,
    right: spacing.screenH,
    alignItems: 'center',
    gap: spacing.medium,
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

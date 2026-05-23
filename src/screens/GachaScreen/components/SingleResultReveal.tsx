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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Modal } from '@/components/AppModal';
import { CloseButton } from '@/components/CloseButton';
import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import type { DrawResultItem } from '@/services/feature/GachaService';
import { borderRadius, colors, shadows, spacing, textStyles, typography, withAlpha } from '@/theme';

import { getRewardDisplayName, RewardPreview } from './RewardPreview';

// ─── CSS Keyframes ──────────────────────────────────────────────────────

registerKeyframes('gachaGlowPulseEpic', '0%{opacity:0.7}50%{opacity:0.42}100%{opacity:0.7}');

registerKeyframes('gachaGlowPulseLegendary', '0%{opacity:0.8}50%{opacity:0.4}100%{opacity:0.8}');

// ─── Constants ──────────────────────────────────────────────────────────

const PREVIEW_SIZES: Record<Rarity, number> = {
  common: 80,
  rare: 100,
  epic: 120,
  legendary: 140,
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
  const borderWidth = BORDER_WIDTHS[rarity];

  // ── Animation state ──
  const [cardScale, setCardScale] = useState(reducedMotion ? 1 : 0);
  const [cardOpacity, setCardOpacity] = useState(reducedMotion ? 1 : 0);
  const [cardTranslateY, setCardTranslateY] = useState(0);
  const [glowOpacity, setGlowOpacity] = useState(0);
  const [glowScale, setGlowScale] = useState(0);
  const [glowPulsing, setGlowPulsing] = useState(false);

  // ── Timer management ──
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
  }, []);
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (reducedMotion) {
      setCardScale(1);
      setCardOpacity(1);
      return;
    }

    switch (rarity) {
      case 'common':
        schedule(() => {
          setCardScale(1);
          setCardOpacity(1);
        }, 16);
        break;

      case 'rare':
        schedule(() => {
          setCardScale(1);
          setCardOpacity(1);
          setGlowOpacity(0.6);
          setGlowScale(1);
        }, 16);
        break;

      case 'epic':
        setCardTranslateY(40);
        schedule(() => {
          setCardOpacity(1);
          setCardScale(1.05);
          setCardTranslateY(0);
          setGlowOpacity(0.7);
          setGlowScale(1);
        }, 16);
        schedule(() => {
          setCardScale(1);
        }, 320);
        schedule(() => {
          setGlowPulsing(true);
        }, 500);
        break;

      case 'legendary':
        setCardTranslateY(-80);
        schedule(() => {
          setGlowScale(1);
          setGlowOpacity(0.8);
        }, 100);
        schedule(() => {
          setCardOpacity(1);
          setCardScale(1.02);
          setCardTranslateY(0);
        }, 200);
        schedule(() => {
          setCardScale(1);
        }, 600);
        schedule(() => {
          setGlowPulsing(true);
        }, 700);
        break;
    }
  }, [rarity, reducedMotion, schedule]);

  // ── Computed styles ──
  const cardAnimStyle: ViewStyle = {
    opacity: cardOpacity,
    transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
    transitionProperty: 'opacity, transform',
    transitionDuration: rarity === 'common' ? '200ms' : rarity === 'rare' ? '300ms' : '350ms',
    transitionTimingFunction:
      rarity === 'legendary'
        ? 'cubic-bezier(0.22, 1, 0.36, 1)'
        : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as unknown as ViewStyle;

  const glowBaseOpacity = glowOpacity;
  const glowAnimStyle: ViewStyle = glowPulsing
    ? ({
        transform: [{ scale: glowScale }],
        animationName: rarity === 'legendary' ? 'gachaGlowPulseLegendary' : 'gachaGlowPulseEpic',
        animationDuration: rarity === 'legendary' ? '2400ms' : '2000ms',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      } as unknown as ViewStyle)
    : ({
        opacity: glowBaseOpacity,
        transform: [{ scale: glowScale }],
        transitionProperty: 'opacity, transform',
        transitionDuration: '500ms',
        transitionTimingFunction: 'ease-out',
      } as unknown as ViewStyle);

  // ── Overlay background color ──
  const isEpicOrLegendary = rarity === 'epic' || rarity === 'legendary';

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        {/* Radial glow for rare+ */}
        {rarity !== 'common' && (
          <View
            style={[
              styles.radialGlow,
              { backgroundColor: withAlpha(visual.color, 0.15) },
              glowAnimStyle,
            ]}
          />
        )}

        {/* Light pillar for legendary */}
        {rarity === 'legendary' && <View style={[styles.lightPillar, glowAnimStyle]} />}

        {/* Card */}
        <View
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
          <CloseButton onPress={onDismiss} variant="onSurface" style={styles.closeButton} />
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
          {item.isDuplicate ? (
            <View style={styles.duplicateRow}>
              <Text style={styles.duplicateTag}>已拥有</Text>
              <Text style={styles.shardAward}>◆ +{item.shardsAwarded}</Text>
            </View>
          ) : (
            item.isNew && <Text style={styles.newTag}>NEW</Text>
          )}

          {onGoEquip && (
            <Pressable style={styles.equipButton} onPress={onGoEquip}>
              <Text style={styles.equipButtonText}>去装扮</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: spacing.xlarge,
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
  duplicateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  duplicateTag: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  shardAward: {
    fontSize: typography.caption,
    fontWeight: typography.weights.bold,
    color: colors.warning,
  },
  equipButton: {
    width: '100%',
    marginTop: spacing.medium,
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
    top: spacing.small,
    right: spacing.small,
  },
});

/**
 * TarotDraw - 转盘抽卡揭示效果（Reanimated 4）
 *
 * 动画流程：多张牌围成一圈旋转 → 玩家点选 → 抽出飞向中央 → 翻转揭示。
 * 使用 `useSharedValue` 驱动所有动画，`runOnJS` 切换阶段，无 `setTimeout`。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, shadows, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const TAROT_COLORS = {
  cardBack: ['#2a2a4e', '#3d3d64', '#2a2a4e'] as const,
  gold: '#d4af37',
  goldGlow: '#ffd700',
  cardFrontGradient: ['#f5f5f5', '#ffffff', '#f5f5f5'] as const,
};

interface WheelCard {
  id: number;
  angle: number;
}

// ─── Card back face (memoized) ──────────────────────────────────────────
const CardBackFace: React.FC<{ width: number; height: number }> = React.memo(
  ({ width, height }) => (
    <View style={[styles.cardBackFace, { width, height }]}>
      <LinearGradient
        colors={[...TAROT_COLORS.cardBack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardBackInner}>
          <View style={[styles.cardBackBorder, { borderColor: TAROT_COLORS.gold }]}>
            <Animated.Text style={styles.symbolText}>☽</Animated.Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  ),
);
CardBackFace.displayName = 'CardBackFace';

// ─── Main component ─────────────────────────────────────────────────────
export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const config = CONFIG.tarot ?? { flipDuration: 800, revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<'waiting' | 'drawing' | 'flipping' | 'revealed'>('waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const onCompleteCalledRef = useRef(false);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const wheelRadius = Math.min(screenWidth * 0.32, 130);

  const wheelCards: WheelCard[] = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count,
    }));
  }, []);

  // ── Shared values ──
  const wheelRotation = useSharedValue(0); // 0→1 = one full turn
  const wheelOpacity = useSharedValue(1);
  const wheelScale = useSharedValue(1);
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(-wheelRadius);
  const drawnCardScale = useSharedValue(1);
  const drawnCardOpacity = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) triggerHaptic('heavy', true);
  }, [enableHaptics]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) triggerHaptic('medium', true);

    flipProgress.value = withTiming(
      1,
      { duration: config.flipDuration ?? 800, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      },
    );
  }, [flipProgress, config.flipDuration, enableHaptics, enterRevealed]);

  const beginFlipAfterDelay = useCallback(() => {
    // Small pause before flip
    drawnCardScale.value = withDelay(300, withTiming(1, { duration: 1 }));
    // Use a dummy animation to trigger the callback after 300ms
    flipProgress.value = withDelay(
      300,
      withTiming(0, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) runOnJS(startFlipping)();
      }),
    );
  }, [drawnCardScale, flipProgress, startFlipping]);

  const startDrawing = useCallback(() => {
    setPhase('drawing');
    if (enableHaptics) triggerHaptic('medium', true);

    drawnCardOpacity.value = 1;

    // Fade out wheel
    wheelScale.value = withTiming(0.5, { duration: 400 });
    wheelOpacity.value = withTiming(0, { duration: 400 });

    // Move drawn card to center
    drawnCardX.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    drawnCardY.value = withTiming(
      0,
      { duration: 500, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(beginFlipAfterDelay)();
      },
    );
  }, [
    drawnCardX,
    drawnCardY,
    drawnCardOpacity,
    wheelScale,
    wheelOpacity,
    enableHaptics,
    beginFlipAfterDelay,
  ]);

  // Current wheel rotation value (tracked via a ref updated in onUpdate callback-free way,
  // but since Reanimated shared values can be read on JS thread, we use .value directly)
  const handleCardSelect = useCallback(
    (cardIndex: number) => {
      if (phase !== 'waiting') return;
      setSelectedCardIndex(cardIndex);
      cancelAnimation(wheelRotation);
      if (enableHaptics) triggerHaptic('medium', true);

      // Calculate selected card position in wheel
      const currentRotation = wheelRotation.value;
      const cardAngle = wheelCards[cardIndex].angle;
      const totalAngle = currentRotation * Math.PI * 2 + cardAngle - Math.PI / 2;
      const x = Math.cos(totalAngle) * wheelRadius;
      const y = Math.sin(totalAngle) * wheelRadius;

      drawnCardX.value = x;
      drawnCardY.value = y;

      startDrawing();
    },
    [
      phase,
      wheelCards,
      wheelRadius,
      wheelRotation,
      drawnCardX,
      drawnCardY,
      enableHaptics,
      startDrawing,
    ],
  );

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 1200);
    return () => clearTimeout(timer);
  }, [onComplete, config.revealHoldDuration]);

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      wheelOpacity.value = 0;
      drawnCardOpacity.value = 1;
      drawnCardScale.value = 1;
      setPhase('revealed');
      const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 0);
      return () => clearTimeout(timer);
    }

    // Slow spin: 4 seconds per revolution, infinite loop
    wheelRotation.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [
    reducedMotion,
    flipProgress,
    wheelOpacity,
    drawnCardOpacity,
    drawnCardScale,
    wheelRotation,
    onComplete,
    config.revealHoldDuration,
  ]);

  // ── Auto-select after 3s if user doesn't tap ──
  useEffect(() => {
    if (phase !== 'waiting' || reducedMotion) return;
    const timer = setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * wheelCards.length);
      handleCardSelect(randomIndex);
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, wheelCards.length, handleCardSelect]);

  // ── Animated styles ──
  const wheelStyle = useAnimatedStyle(() => ({
    opacity: wheelOpacity.value,
    transform: [{ scale: wheelScale.value }, { rotate: `${wheelRotation.value * 360}deg` }],
  }));

  const drawnCardStyle = useAnimatedStyle(() => ({
    opacity: drawnCardOpacity.value,
    transform: [
      { translateX: drawnCardX.value },
      { translateY: drawnCardY.value },
      { scale: drawnCardScale.value },
      { perspective: 1200 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  const backOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
  }));

  const frontOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: -1 }],
  }));

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <LinearGradient
        colors={[...TAROT_COLORS.cardFrontGradient]}
        style={StyleSheet.absoluteFill}
      />

      {/* Prompt text */}
      {phase === 'waiting' && (
        <View style={styles.promptContainer}>
          <Animated.Text style={[styles.promptText, { color: TAROT_COLORS.gold }]}>
            选择一张牌
          </Animated.Text>
        </View>
      )}

      {/* Wheel of cards */}
      {phase !== 'revealed' && (
        <Animated.View
          testID={`${testIDPrefix}-wheel`}
          style={[
            styles.wheel,
            {
              width: wheelRadius * 2.5,
              height: wheelRadius * 2.5,
            },
            wheelStyle,
          ]}
        >
          {wheelCards.map((card, index) => {
            const x = Math.cos(card.angle - Math.PI / 2) * wheelRadius;
            const y = Math.sin(card.angle - Math.PI / 2) * wheelRadius;
            const rotation = (card.angle * 180) / Math.PI;
            const isSelected = selectedCardIndex === index;

            return (
              <View
                key={card.id}
                style={[
                  styles.wheelCard,
                  isSelected && styles.hidden,
                  {
                    width: cardWidth * 0.55,
                    height: cardHeight * 0.55,
                    transform: [{ translateX: x }, { translateY: y }, { rotate: `${rotation}deg` }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => handleCardSelect(index)}
                  disabled={phase !== 'waiting'}
                  style={styles.pressableFill}
                >
                  <CardBackFace width={cardWidth * 0.55} height={cardHeight * 0.55} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Drawn card (fly to center → flip) */}
      <Animated.View
        testID={`${testIDPrefix}-drawn-card`}
        style={[styles.drawnCard, { width: cardWidth, height: cardHeight }, drawnCardStyle]}
      >
        {/* Card back */}
        <Animated.View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
          <CardBackFace width={cardWidth} height={cardHeight} />
        </Animated.View>

        {/* Card front */}
        <Animated.View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />

          {phase === 'revealed' && (
            <GlowBorder
              width={cardWidth + common.glowPadding}
              height={cardHeight + common.glowPadding}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={common.glowBorderWidth}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={common.glowFlashCount}
              flashDuration={common.glowFlashDuration}
              onComplete={handleGlowComplete}
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCard: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    shadowColor: shadows.md.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  cardBackFace: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  cardBackInner: {
    flex: 1,
    padding: 6,
  },
  cardBackBorder: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolText: {
    fontSize: 36,
    color: TAROT_COLORS.gold,
    textShadowColor: TAROT_COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    shadowColor: TAROT_COLORS.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardBackZ: {
    zIndex: 2,
  },
  cardFrontZ: {
    zIndex: 1,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  hidden: {
    opacity: 0,
  },
  pressableFill: {
    flex: 1,
  },
  promptContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: TAROT_COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

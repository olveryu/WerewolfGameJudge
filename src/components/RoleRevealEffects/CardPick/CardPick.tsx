/**
 * CardPick - 桌面抽牌揭示效果（Reanimated 4）
 *
 * 动画流程：面朝下的牌平铺在桌面（网格排列）→ 玩家点选一张 → 其余牌消失 →
 * 被选牌飞到中央放大 → 翻转揭示角色。
 *
 * `remainingCards` 决定桌面上展示多少张牌（= 总人数 - 已查看人数），
 * 让后查看的玩家看到更少的牌，营造"越来越少"的紧张感。
 * 渲染抽牌动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const TABLE_COLORS = {
  /** 桌面 — 暖色亚麻 */
  felt: ['#e6dfd5', '#f0ebe3', '#e6dfd5'] as const,
  /** 牌背 — 象牙白 */
  cardBack: ['#f5f1eb', '#faf7f2', '#f5f1eb'] as const,
  /** 牌背装饰 — 青铜 */
  accent: '#8b7355',
  accentLight: '#b8a080',
  /** 牌背中央符号 */
  symbol: '♠',
};

// ─── Extended props ─────────────────────────────────────────────────────
export interface CardPickProps extends RoleRevealEffectProps {
  /** Number of remaining (unviewed) cards to display on the table */
  remainingCards?: number;
}

// ─── Mini card back face (memoized) ─────────────────────────────────────
const MiniCardBack: React.FC<{ width: number; height: number }> = React.memo(
  ({ width, height }) => (
    <View style={[styles.miniCardBack, { width, height }]}>
      <LinearGradient
        colors={[...TABLE_COLORS.cardBack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.miniCardInner}>
          <View style={[styles.miniCardBorder, { borderColor: TABLE_COLORS.accentLight }]}>
            <Animated.Text style={styles.miniCardSymbol}>{TABLE_COLORS.symbol}</Animated.Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  ),
);
MiniCardBack.displayName = 'MiniCardBack';

// ─── Main component ─────────────────────────────────────────────────────
export const CardPick: React.FC<CardPickProps> = ({
  role,
  onComplete,
  remainingCards = 12,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'card-pick',
}) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const config = CONFIG.cardPick;
  const common = CONFIG.common;

  const [phase, setPhase] = useState<'spreading' | 'waiting' | 'picking' | 'flipping' | 'revealed'>(
    'spreading',
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const onCompleteCalledRef = useRef(false);

  // ── Lock initial card count at mount (grid layout never re-flows) ──
  const initialCardCountRef = useRef(Math.max(1, Math.min(remainingCards, 16)));
  const initialCardCount = initialCardCountRef.current;

  // Track cards removed by other players viewing their roles in real-time
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const prevRemainingRef = useRef(remainingCards);
  const aliveCount = initialCardCount - removedIndices.size;

  // ── Card layout calculation (based on locked initial count) ──
  const cols = Math.min(config.maxColumns, initialCardCount);
  const rows = Math.ceil(initialCardCount / cols);
  const miniCardWidth = Math.min(
    screenWidth * config.miniCardWidthRatio,
    (screenWidth - config.cardGap * (cols + 1)) / cols,
  );
  const miniCardHeight = miniCardWidth * config.miniCardAspectRatio;
  const revealCardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const revealCardHeight = revealCardWidth * common.cardAspectRatio;

  // Grid positions for each card (locked to initial count)
  const gridPositions = useMemo(() => {
    const totalGridWidth = cols * miniCardWidth + (cols - 1) * config.cardGap;
    const totalGridHeight = rows * miniCardHeight + (rows - 1) * config.cardGap;
    const startX = -totalGridWidth / 2 + miniCardWidth / 2;
    const startY = -totalGridHeight / 2 + miniCardHeight / 2;

    return Array.from({ length: initialCardCount }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        x: startX + col * (miniCardWidth + config.cardGap),
        y: startY + row * (miniCardHeight + config.cardGap),
      };
    });
  }, [initialCardCount, cols, rows, miniCardWidth, miniCardHeight, config.cardGap]);

  // ── Shared values ──
  const spreadProgress = useSharedValue(0); // 0 → 1: cards appear on table
  const otherCardsOpacity = useSharedValue(1); // fade out non-selected cards
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(0);
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
      { duration: config.flipDuration, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      },
    );
  }, [flipProgress, config.flipDuration, enableHaptics, enterRevealed]);

  const startFlipAfterDelay = useCallback(() => {
    // Short pause before flip
    flipProgress.value = withDelay(
      200,
      withTiming(0, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) runOnJS(startFlipping)();
      }),
    );
  }, [flipProgress, startFlipping]);

  const handleCardSelect = useCallback(
    (index: number) => {
      if (phase !== 'waiting') return;
      setSelectedIndex(index);
      setPhase('picking');
      if (enableHaptics) triggerHaptic('medium', true);

      const pos = gridPositions[index];
      // Set initial position to the card's grid position
      drawnCardX.value = pos.x;
      drawnCardY.value = pos.y;
      drawnCardOpacity.value = 1;

      // Fade out other cards
      otherCardsOpacity.value = withTiming(0, { duration: config.fadeOutDuration });

      // Fly to center
      drawnCardX.value = withTiming(0, {
        duration: config.flyToCenterDuration,
        easing: Easing.out(Easing.cubic),
      });
      drawnCardY.value = withTiming(
        0,
        { duration: config.flyToCenterDuration, easing: Easing.out(Easing.cubic) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(startFlipAfterDelay)();
        },
      );
    },
    [
      phase,
      gridPositions,
      drawnCardX,
      drawnCardY,
      drawnCardOpacity,
      otherCardsOpacity,
      config.fadeOutDuration,
      config.flyToCenterDuration,
      enableHaptics,
      startFlipAfterDelay,
    ],
  );

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    const timer = setTimeout(() => onComplete(), config.revealHoldDuration);
    return () => clearTimeout(timer);
  }, [onComplete, config.revealHoldDuration]);

  // ── React to other players viewing roles: remove random cards ──
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'spreading') return;

    const diff = prevRemainingRef.current - remainingCards;
    if (diff <= 0) return;
    prevRemainingRef.current = remainingCards;

    setRemovedIndices((prev) => {
      const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
        (i) => !prev.has(i),
      );
      // Keep at least 1 card alive for the player to pick
      const maxRemovable = Math.max(0, aliveIndices.length - 1);
      const toRemove = Math.min(diff, maxRemovable);
      const shuffled = [...aliveIndices].sort(() => Math.random() - 0.5);
      const next = new Set(prev);
      for (let i = 0; i < toRemove; i++) {
        next.add(shuffled[i]);
      }
      return next;
    });

    if (enableHaptics) triggerHaptic('light', true);
  }, [remainingCards, phase, initialCardCount, enableHaptics]);

  // ── Kick-off: spread cards onto table ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      spreadProgress.value = 1;
      otherCardsOpacity.value = 0;
      drawnCardOpacity.value = 1;
      setPhase('revealed');
      const timer = setTimeout(() => onComplete(), config.revealHoldDuration);
      return () => clearTimeout(timer);
    }

    spreadProgress.value = withTiming(
      1,
      { duration: config.spreadDuration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('waiting');
      },
    );
  }, [
    reducedMotion,
    spreadProgress,
    flipProgress,
    otherCardsOpacity,
    drawnCardOpacity,
    onComplete,
    config.spreadDuration,
    config.revealHoldDuration,
  ]);

  // ── Auto-select after timeout if user doesn't tap ──
  useEffect(() => {
    if (phase !== 'waiting' || reducedMotion) return;
    const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
      (i) => !removedIndices.has(i),
    );
    if (aliveIndices.length === 0) return;
    const timer = setTimeout(() => {
      const randomIndex = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
      handleCardSelect(randomIndex);
    }, config.autoSelectTimeout);
    return () => clearTimeout(timer);
  }, [
    phase,
    reducedMotion,
    initialCardCount,
    removedIndices,
    handleCardSelect,
    config.autoSelectTimeout,
  ]);

  // ── Animated styles for drawn card (fly-to-center + flip) ──
  const drawnCardStyle = useAnimatedStyle(() => ({
    opacity: drawnCardOpacity.value,
    transform: [
      { translateX: drawnCardX.value },
      { translateY: drawnCardY.value },
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
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
      {/* Table felt background */}
      <LinearGradient
        colors={[...TABLE_COLORS.felt]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Prompt text */}
      {(phase === 'spreading' || phase === 'waiting') && (
        <View style={styles.promptContainer}>
          <Animated.Text style={[styles.promptText, { color: TABLE_COLORS.accent }]}>
            {aliveCount === 1 ? '最后一张牌' : `还剩 ${aliveCount} 张，选一张`}
          </Animated.Text>
        </View>
      )}

      {/* Card grid — all face-down mini cards */}
      {(phase === 'spreading' || phase === 'waiting' || phase === 'picking') && (
        <View
          testID={`${testIDPrefix}-grid`}
          style={[styles.gridCenter, { width: screenWidth, height: screenHeight }]}
        >
          {gridPositions.map((pos, index) => {
            const isSelected = selectedIndex === index;
            // Don't render selected card here during picking — it's rendered separately
            if (isSelected && phase === 'picking') return null;

            return (
              <AnimatedMiniCard
                key={index}
                index={index}
                x={pos.x}
                y={pos.y}
                width={miniCardWidth}
                height={miniCardHeight}
                spreadProgress={spreadProgress}
                otherCardsOpacity={otherCardsOpacity}
                isSelected={isSelected}
                removed={removedIndices.has(index)}
                staggerDelay={index * config.spreadStagger}
                onPress={handleCardSelect}
                disabled={phase !== 'waiting' || removedIndices.has(index)}
                testIDPrefix={testIDPrefix}
              />
            );
          })}
        </View>
      )}

      {/* Drawn card (fly to center → flip) — only mount after selection */}
      {selectedIndex !== null && (
        <Animated.View
          testID={`${testIDPrefix}-drawn-card`}
          style={[
            styles.drawnCard,
            { width: revealCardWidth, height: revealCardHeight },
            drawnCardStyle,
          ]}
        >
          {/* Card back */}
          <Animated.View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
            <MiniCardBack width={revealCardWidth} height={revealCardHeight} />
          </Animated.View>

          {/* Card front */}
          <Animated.View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
            <RoleCardContent
              roleId={role.id as RoleId}
              width={revealCardWidth}
              height={revealCardHeight}
            />

            {phase === 'revealed' && (
              <GlowBorder
                width={revealCardWidth + common.glowPadding}
                height={revealCardHeight + common.glowPadding}
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
      )}
    </View>
  );
};

// ─── Animated mini card on the table ────────────────────────────────────
interface AnimatedMiniCardProps {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  spreadProgress: SharedValue<number>;
  otherCardsOpacity: SharedValue<number>;
  isSelected: boolean;
  /** Whether this card was removed by another player viewing their role */
  removed: boolean;
  staggerDelay: number;
  onPress: (index: number) => void;
  disabled: boolean;
  testIDPrefix: string;
}

const AnimatedMiniCard: React.FC<AnimatedMiniCardProps> = React.memo(
  ({
    index,
    x,
    y,
    width,
    height,
    spreadProgress,
    otherCardsOpacity,
    isSelected,
    removed,
    staggerDelay,
    onPress,
    disabled,
    testIDPrefix,
  }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    const cfg = CONFIG.cardPick;
    const totalDuration = cfg.spreadDuration + cfg.spreadStagger * 15; // max card count

    // Exit animation when another player takes a card
    const exitProgress = useSharedValue(1); // 1 = alive, 0 = gone
    useEffect(() => {
      if (removed) {
        exitProgress.value = withTiming(0, {
          duration: cfg.cardRemoveExitDuration,
          easing: Easing.in(Easing.cubic),
        });
      }
    }, [removed, exitProgress, cfg.cardRemoveExitDuration]);

    // Each card fades in with stagger, fades out when removed
    const animStyle = useAnimatedStyle(() => {
      const staggerFraction = staggerDelay / totalDuration;
      const localProgress = Math.max(
        0,
        Math.min(1, (spreadProgress.value - staggerFraction) / (1 - staggerFraction)),
      );
      const alive = exitProgress.value;

      return {
        opacity: (isSelected ? 1 : otherCardsOpacity.value) * localProgress * alive,
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: interpolate(localProgress, [0, 1], [0.3, 1]) * (0.6 + 0.4 * alive) },
          { rotateZ: `${interpolate(alive, [0, 1], [8, 0])}deg` },
        ],
      };
    });

    return (
      <Animated.View
        testID={`${testIDPrefix}-card-${index}`}
        style={[styles.miniCardWrapper, { width, height }, animStyle]}
      >
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          style={styles.pressableFill}
          accessibilityRole="button"
          accessibilityLabel={`牌 ${index + 1}`}
        >
          <MiniCardBack width={width} height={height} />
        </Pressable>
      </Animated.View>
    );
  },
);
AnimatedMiniCard.displayName = 'AnimatedMiniCard';

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardWrapper: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.12)',
  },
  miniCardBack: {
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  miniCardInner: {
    flex: 1,
    padding: 5,
  },
  miniCardBorder: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardSymbol: {
    fontSize: 22,
    color: TABLE_COLORS.accent,
    opacity: 0.6,
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.15)',
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
  pressableFill: {
    flex: 1,
  },
  promptContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
    zIndex: 10,
  },
  promptText: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

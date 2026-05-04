/**
 * CardPick - 桌面抽牌揭示效果（Reanimated 4 + Skia）
 *
 * 动画流程：木质画框 + 散落筹码的桌面 → 面朝下的牌平铺（网格排列）→
 * 玩家点选一张 → 其余牌暗化消失 → 金色粒子拖尾飞向中央 →
 * 充能光环脉冲 → 翻转（侧光条扫过） → 揭示角色。
 *
 * `remainingCards` 决定桌面上展示多少张牌（= 总人数 - 已查看人数），
 * 让后查看的玩家看到更少的牌，营造"越来越少"的紧张感。
 * 渲染抽牌动画与触觉反馈。不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
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
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, colors } from '@/theme';

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
  /** Wood frame */
  woodDark: '#5a3a1e',
  woodLight: '#8b6914',
  woodCorner: '#4a2c12',
  /** Table chips */
  chipRed: '#cc3333',
  chipBlue: '#3366aa',
  chipGold: '#d4af37',
  chipGreen: '#338844',
  /** Trail & aura */
  trailGold: '#d4af37',
  trailGlow: '#ffd700',
  chargeAura: '#d4af37',
  /** Light bars */
  lightBar: '#ffffff',
};

// ─── Pre-computed table chip positions ─────────────────────────────────
function createTableChips(screenW: number, screenH: number) {
  return [
    { x: screenW * 0.08, y: screenH * 0.15, r: 8, color: TABLE_COLORS.chipRed },
    { x: screenW * 0.92, y: screenH * 0.2, r: 7, color: TABLE_COLORS.chipBlue },
    { x: screenW * 0.15, y: screenH * 0.82, r: 9, color: TABLE_COLORS.chipGold },
    { x: screenW * 0.88, y: screenH * 0.78, r: 7, color: TABLE_COLORS.chipGreen },
    { x: screenW * 0.05, y: screenH * 0.5, r: 6, color: TABLE_COLORS.chipRed },
    { x: screenW * 0.95, y: screenH * 0.45, r: 8, color: TABLE_COLORS.chipBlue },
    { x: screenW * 0.2, y: screenH * 0.12, r: 6, color: TABLE_COLORS.chipGold },
    { x: screenW * 0.82, y: screenH * 0.88, r: 7, color: TABLE_COLORS.chipGreen },
  ];
}

// ─── Extended props ─────────────────────────────────────────────────────
interface CardPickProps extends RoleRevealEffectProps {
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const tableChips = useMemo(
    () => createTableChips(screenWidth, screenHeight),
    [screenWidth, screenHeight],
  );
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.cardPick;
  const common = CONFIG.common;

  const [phase, setPhase] = useState<'spreading' | 'waiting' | 'picking' | 'flipping' | 'revealed'>(
    'spreading',
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

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

  // Scene element shared values
  const trailOpacity = useSharedValue(0);
  const chargeAuraPulse = useSharedValue(0);
  const chargeAuraOpacity = useSharedValue(0);
  const lightBarProgress = useSharedValue(0);
  const lightBarOpacity = useSharedValue(0);
  const chipBobble = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) void triggerHaptic('heavy', true);
  }, [enableHaptics]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) void triggerHaptic('medium', true);

    // Light bars sweep during flip
    lightBarOpacity.value = withSequence(
      withTiming(0.6, { duration: 150 }),
      withDelay(config.flipDuration - 200, withTiming(0, { duration: 200 })),
    );
    lightBarProgress.value = withTiming(1, {
      duration: config.flipDuration,
      easing: Easing.inOut(Easing.cubic),
    });

    // Charge aura fades out as flip starts
    chargeAuraOpacity.value = withTiming(0, { duration: 400 });

    flipProgress.value = withTiming(
      1,
      { duration: config.flipDuration, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      },
    );
  }, [
    flipProgress,
    config.flipDuration,
    enableHaptics,
    enterRevealed,
    lightBarOpacity,
    lightBarProgress,
    chargeAuraOpacity,
  ]);

  const startFlipAfterDelay = useCallback(() => {
    // Charge aura glow before flip
    chargeAuraOpacity.value = withTiming(0.7, { duration: 200 });
    chargeAuraPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.5, { duration: 300, easing: Easing.inOut(Easing.quad) }),
      ),
      2,
    );

    // Short pause before flip
    flipProgress.value = withDelay(
      200,
      withTiming(0, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) runOnJS(startFlipping)();
      }),
    );
  }, [flipProgress, startFlipping, chargeAuraOpacity, chargeAuraPulse]);

  const handleCardSelect = useCallback(
    (index: number) => {
      if (phase !== 'waiting') return;
      setSelectedIndex(index);
      setPhase('picking');
      if (enableHaptics) void triggerHaptic('medium', true);

      const pos = gridPositions[index]!;
      // Set initial position to the card's grid position
      drawnCardX.value = pos.x;
      drawnCardY.value = pos.y;
      drawnCardOpacity.value = 1;

      // Trail follows the card
      trailOpacity.value = withSequence(
        withTiming(0.8, { duration: 80 }),
        withDelay(config.flyToCenterDuration - 150, withTiming(0, { duration: 300 })),
      );

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
      trailOpacity,
      config.fadeOutDuration,
      config.flyToCenterDuration,
      enableHaptics,
      startFlipAfterDelay,
    ],
  );

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
        next.add(shuffled[i]!);
      }
      return next;
    });

    if (enableHaptics) void triggerHaptic('light', true);
  }, [remainingCards, phase, initialCardCount, enableHaptics]);

  // ── Kick-off: spread cards onto table ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      spreadProgress.value = 1;
      otherCardsOpacity.value = 0;
      drawnCardOpacity.value = 1;
      setPhase('revealed');
      fireComplete();
      return;
    }

    spreadProgress.value = withTiming(
      1,
      { duration: config.spreadDuration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('waiting');
      },
    );

    // Chips gentle bobble
    chipBobble.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }),
      -1,
    );
  }, [
    reducedMotion,
    spreadProgress,
    flipProgress,
    otherCardsOpacity,
    drawnCardOpacity,
    chipBobble,
    fireComplete,
    config.spreadDuration,
  ]);

  // ── Auto-select after timeout if user doesn't tap ──
  const autoSelectRandom = useCallback(() => {
    const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
      (i) => !removedIndices.has(i),
    );
    if (aliveIndices.length === 0) return;
    const randomIndex = aliveIndices[Math.floor(Math.random() * aliveIndices.length)]!;
    handleCardSelect(randomIndex);
  }, [initialCardCount, removedIndices, handleCardSelect]);
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'waiting' && !reducedMotion,
    autoSelectRandom,
  );

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

  // ── Skia derived values ──
  const chargeR = useDerivedValue(() => 60 + chargeAuraPulse.value * 12);
  const chargeOp = useDerivedValue(() => chargeAuraOpacity.value);
  const lbOp = useDerivedValue(() => lightBarOpacity.value);
  const lbX = useDerivedValue(
    () => -screenWidth * 0.3 + lightBarProgress.value * screenWidth * 0.6,
  );
  const lbX2 = useDerivedValue(() => lbX.value + 20);

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />
      {/* Table felt background */}
      <LinearGradient
        colors={[...TABLE_COLORS.felt]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Wood frame border */}
      <View style={styles.woodFrame}>
        <View style={styles.woodFrameInner} />
      </View>

      {/* Skia scene layer: chips, trail, charge aura, light bars */}
      {!reducedMotion && (
        <Canvas style={styles.fullScreen}>
          {/* Table chips — decorative scattered tokens */}
          {tableChips.map((chip, i) => (
            <Group key={`chip-${i}`}>
              {/* Chip body */}
              <Circle cx={chip.x} cy={chip.y} r={chip.r} color={chip.color} opacity={0.5} />
              {/* Inner ring */}
              <Circle
                cx={chip.x}
                cy={chip.y}
                r={chip.r * 0.6}
                color="#ffffff"
                opacity={0.15}
                style="stroke"
                strokeWidth={1}
              />
              {/* Center dot */}
              <Circle cx={chip.x} cy={chip.y} r={1.5} color="#ffffff" opacity={0.2} />
            </Group>
          ))}

          {/* Charge aura — pulsing ring before flip */}
          <Circle cx={screenWidth / 2} cy={screenHeight / 2} r={chargeR} opacity={chargeOp}>
            <RadialGradient
              c={vec(screenWidth / 2, screenHeight / 2)}
              r={72}
              colors={[`${TABLE_COLORS.chargeAura}60`, `${TABLE_COLORS.chargeAura}00`]}
            />
            <Blur blur={10} />
          </Circle>

          {/* Light bars — sweep during flip */}
          <Group opacity={lbOp} blendMode="screen">
            <RoundedRect
              x={lbX}
              y={screenHeight * 0.25}
              width={4}
              height={screenHeight * 0.5}
              r={2}
              color={TABLE_COLORS.lightBar}
              opacity={0.4}
            >
              <Blur blur={6} />
            </RoundedRect>
            <RoundedRect
              x={lbX2}
              y={screenHeight * 0.3}
              width={2}
              height={screenHeight * 0.4}
              r={1}
              color={TABLE_COLORS.lightBar}
              opacity={0.2}
            >
              <Blur blur={4} />
            </RoundedRect>
          </Group>
        </Canvas>
      )}

      {/* Prompt text with dealer hand */}
      <HintWithWarning
        hintText={
          phase === 'spreading' || phase === 'waiting'
            ? aliveCount === 1
              ? '🤚 最后一张，点击翻开'
              : `🤚 还剩 ${aliveCount} 张，点选一张`
            : null
        }
        showWarning={autoTimeoutWarning}
        hintTextStyle={styles.hintAccent}
      />

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
                key={`card-${pos.x}-${pos.y}`}
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
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />

            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={revealCardWidth}
                cardHeight={revealCardHeight}
                animate={!reducedMotion}
                onComplete={fireComplete}
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
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  woodFrame: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 4,
    borderColor: TABLE_COLORS.woodDark,
    borderRadius: borderRadius.medium,
    pointerEvents: 'none',
  },
  woodFrameInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: TABLE_COLORS.woodLight,
    borderRadius: borderRadius.small,
    margin: 3,
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
    overflow: 'visible',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.medium,
    overflow: 'visible',
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
  hintAccent: {
    color: TABLE_COLORS.accent,
    letterSpacing: 1,
  },
});

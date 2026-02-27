/**
 * VillagerRevealEffect - 村民阵营揭示特效（Reanimated 4）
 *
 * 翻牌后在卡片区域渲染宁静夜空系列动画：
 * 1. **卡片光晕** — animated boxShadow 从亮→柔和→持续微弱灰蓝发光
 * 2. 护盾涟漪（2 层）— 从中心柔和扩散后淡出（比狼冲击波慢且柔）
 * 3. 萤火虫粒子（16 颗）— 缓慢漂浮上升，带轻柔横向摇摆，持续循环
 * 4. 闪烁星点（10 颗）— 固定位置交替闪烁
 *
 * 萤火虫和星光持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const AE = CONFIG.alignmentEffects;

// ─── Pre-computed arrays ──────────────────────────────────────────────

/** Shield ripple configs — gentler than wolf shockwaves */
const RIPPLE_CONFIGS = [
  { delay: 0.05, endP: 0.5, maxScale: 2.5, bw: 1.5, peakOpacity: 0.25 },
  { delay: 0.18, endP: 0.65, maxScale: 3, bw: 1, peakOpacity: 0.15 },
] as const;

const FIREFLIES = Array.from({ length: AE.villagerFireflyCount }, (_, i) => {
  const phase = (i / AE.villagerFireflyCount) * 360;
  // Horizontal base position ratio (0.08–0.92 of cardWidth)
  const xRatio = 0.08 + ((i * 61 + 17) % 84) / 100;
  // Vertical start (bottom half: 0.55–0.95 of cardHeight)
  const startYRatio = 0.55 + ((i * 37 + 11) % 40) / 100;
  // Drift height (0.35–0.65 of cardHeight)
  const driftRatio = 0.35 + ((i * 23 + 7) % 30) / 100;
  // Wobble amplitude (0.03–0.07 of cardWidth)
  const wobbleRatio = 0.03 + ((i * 13 + 3) % 40) / 1000;
  // Particle size ratio
  const sizeRatio = (2 + (i % 3)) / 320;
  return { index: i, phase, xRatio, startYRatio, driftRatio, wobbleRatio, sizeRatio };
});

const STARS = Array.from({ length: AE.villagerStarCount }, (_, i) => {
  // Distribute around card center in an elliptical pattern
  const angle = (i / AE.villagerStarCount) * Math.PI * 2 + ((i * 0.3) % 0.6);
  const rRatio = 0.32 + ((i * 17 + 5) % 18) / 100; // 0.32–0.50 of cardWidth
  const xRatio = 0.5 + Math.cos(angle) * rRatio;
  const yRatio = 0.42 + Math.sin(angle) * rRatio * 0.75; // compressed vertically
  const sizeRatio = (1.5 + (i % 3)) / 320;
  const twinklePhase = (i / AE.villagerStarCount) * 360;
  return { index: i, xRatio, yRatio, sizeRatio, twinklePhase };
});

// ─── Sub-components ──────────────────────────────────────────────────────

/** Gentle shield ripple expanding from center */
const ShieldRipple = React.memo(function ShieldRipple({
  delay,
  endP,
  maxScale,
  bw,
  peakOpacity,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  delay: number;
  endP: number;
  maxScale: number;
  bw: number;
  peakOpacity: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const size = cardWidth * 0.25;

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [delay, endP], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(
        lp,
        [0, 0.1, 0.4, 1],
        [peakOpacity, peakOpacity * 0.8, peakOpacity * 0.4, 0],
      ),
      transform: [{ scale: interpolate(lp, [0, 0.5, 1], [0, maxScale * 0.6, maxScale]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.rippleBase,
        {
          top: centerY - size / 2,
          left: centerX - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: bw,
          borderColor: color,
        },
        animStyle,
      ]}
    />
  );
});

/** Floating firefly particle that drifts upward with gentle wobble */
const Firefly = React.memo(function Firefly({
  phase,
  xRatio,
  startYRatio,
  driftRatio,
  wobbleRatio,
  sizeRatio,
  fireflyCycle,
  appear,
  color,
  cardWidth,
  cardHeight,
}: {
  phase: number;
  xRatio: number;
  startYRatio: number;
  driftRatio: number;
  wobbleRatio: number;
  sizeRatio: number;
  fireflyCycle: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const baseX = xRatio * cardWidth;
  const startY = startYRatio * cardHeight;
  const driftHeight = driftRatio * cardHeight;
  const wobbleAmp = wobbleRatio * cardWidth;
  const size = Math.max(1.5, sizeRatio * cardWidth);

  const animStyle = useAnimatedStyle(() => {
    // fireflyCycle goes 0→360 with repeat; phase offsets each particle
    const currentPhase = (fireflyCycle.value + phase) % 360;
    const t = currentPhase / 360; // 0–1 progress through one rise cycle
    const y = startY - t * driftHeight;
    const x = baseX + Math.sin(((currentPhase * Math.PI) / 180) * 3) * wobbleAmp;

    // Fade in near start, stay visible in the middle, fade out near top
    const alpha = interpolate(t, [0, 0.12, 0.65, 1], [0, 0.85, 0.85, 0], Extrapolation.CLAMP);

    return {
      opacity: appear.value * alpha,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.fireflyBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${size * 3}px ${size}px ${color}50`,
        },
        animStyle,
      ]}
    />
  );
});

/** Twinkling star point at a fixed position */
const TwinkleStar = React.memo(function TwinkleStar({
  xRatio,
  yRatio,
  sizeRatio,
  twinklePhase,
  twinkleCycle,
  appear,
  color,
  cardWidth,
  cardHeight,
}: {
  xRatio: number;
  yRatio: number;
  sizeRatio: number;
  twinklePhase: number;
  twinkleCycle: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const x = xRatio * cardWidth;
  const y = yRatio * cardHeight;
  const size = Math.max(1.5, sizeRatio * cardWidth);

  const animStyle = useAnimatedStyle(() => {
    const phaseRad = ((twinkleCycle.value + twinklePhase) * Math.PI) / 180;
    const sinVal = Math.sin(phaseRad);
    const alpha = interpolate(
      sinVal,
      [-1, -0.2, 0.2, 1],
      [0.05, 0.15, 0.5, 0.85],
      Extrapolation.CLAMP,
    );
    const scale = 0.4 + 0.6 * ((sinVal + 1) / 2);

    return {
      opacity: appear.value * alpha,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.starBase,
        {
          top: y - size / 2,
          left: x - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${size * 4}px ${size * 1.5}px ${color}60`,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Main component ──────────────────────────────────────────────────────

interface VillagerRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const VillagerRevealEffect: React.FC<VillagerRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const progress = useSharedValue(0);
  const appear = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const fireflyCycle = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    // Entrance transient: 0→1 over 2.5s
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Elements appear (0.3s delay, 0.5s ease-out)
    appear.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow: peak → medium → persist
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(0.5, { duration: 600, easing: Easing.out(Easing.quad) }),
        withTiming(0.25, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Continuous firefly drift cycle (0→360, repeat)
    fireflyCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, {
          duration: AE.villagerFireflyDuration,
          easing: Easing.linear,
        }),
        -1,
      ),
    );

    // Continuous star twinkle cycle
    twinkleCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, {
          duration: AE.villagerTwinkleDuration,
          easing: Easing.linear,
        }),
        -1,
      ),
    );
  }, [animate, progress, appear, glowIntensity, fireflyCycle, twinkleCycle]);

  // Card glow wrapper
  const cardGlowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  // Flash overlay — softer than other factions
  const flashStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.06, 0.15, 0.35], [0, 0.5, 0.15, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]} pointerEvents="none">
      {/* Persistent card glow */}
      <Animated.View
        style={[
          styles.cardGlow,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.3)}px ${Math.round(cardWidth * 0.1)}px ${glowColor}, 0 0 ${Math.round(cardWidth * 0.5)}px ${Math.round(cardWidth * 0.2)}px ${primaryColor}50`,
          },
          cardGlowStyle,
        ]}
      />

      {/* Flash overlay */}
      <Animated.View style={[styles.flash, { backgroundColor: primaryColor }, flashStyle]} />

      {/* Shield ripples — gentle expanding rings */}
      {RIPPLE_CONFIGS.map((cfg, i) => (
        <ShieldRipple
          key={i}
          {...cfg}
          progress={progress}
          color={glowColor}
          centerX={centerX}
          centerY={centerY}
          cardWidth={cardWidth}
        />
      ))}

      {/* Twinkling stars — fixed positions */}
      {STARS.map((star) => (
        <TwinkleStar
          key={star.index}
          xRatio={star.xRatio}
          yRatio={star.yRatio}
          sizeRatio={star.sizeRatio}
          twinklePhase={star.twinklePhase}
          twinkleCycle={twinkleCycle}
          appear={appear}
          color={particleColor}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      ))}

      {/* Floating fireflies — continuous upward drift */}
      {FIREFLIES.map((ff) => (
        <Firefly
          key={ff.index}
          phase={ff.phase}
          xRatio={ff.xRatio}
          startYRatio={ff.startYRatio}
          driftRatio={ff.driftRatio}
          wobbleRatio={ff.wobbleRatio}
          sizeRatio={ff.sizeRatio}
          fireflyCycle={fireflyCycle}
          appear={appear}
          color={particleColor}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.medium,
  },
  rippleBase: {
    position: 'absolute',
  },
  fireflyBase: {
    position: 'absolute',
  },
  starBase: {
    position: 'absolute',
  },
});

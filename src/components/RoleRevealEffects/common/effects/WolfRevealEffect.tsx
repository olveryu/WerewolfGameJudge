/**
 * WolfRevealEffect - 狼人阵营揭示特效（Reanimated 4）
 *
 * 翻牌后在卡片区域渲染暗红系列动画，严格对标 HTML demo v2：
 * 1. **卡片光晕** — animated boxShadow 从极亮爆发→中等→**持续微弱暗红发光**
 * 2. 能量冲击波（3 层）— 从中心扩散后淡出
 * 3. 狼眼闪现 — 两只红色椭圆闪烁后消失
 * 4. 底部烟雾 — 缓慢升起后保持半透明
 * 5. 火花碎片（24 颗）— 从中心射出后淡出
 *
 * 除卡片光晕和底部烟雾外所有子元素均为瞬态（2.5s 内完成）。
 * 不 import service，不含业务逻辑。
 */
import { LinearGradient } from 'expo-linear-gradient';
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
import Svg, { Line } from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const AE = CONFIG.alignmentEffects;

// ─── Pre-computed arrays ──────────────────────────────────────────────

// HTML demo: all 3 waves use same @keyframes wolfWaveExpand (scale 0→3.5→5)
// Layers differ only in delay/opacity/border-width
const WAVE_CONFIGS = [
  { startP: 0.08, endP: 0.55, maxScale: 5, bw: 2, peakOpacity: 0.6 },
  { startP: 0.14, endP: 0.65, maxScale: 5, bw: 1.5, peakOpacity: 0.3 },
  { startP: 0.22, endP: 0.78, maxScale: 5, bw: 1, peakOpacity: 0.15 },
] as const;

const SPARK_COUNT = 24;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 3) * 0.15;
  // Distance as ratio of card half-width (HTML: 40-140px on 140px card → 0.28-1.0)
  const distanceRatio = 0.28 + ((i * 37) % 100) / 140;
  // HTML demo: hue 0-40, saturation 100%, lightness 50-80%
  const hue = (i * 17) % 40;
  const lightness = 50 + ((i * 13) % 30);
  return {
    index: i,
    targetXRatio: Math.cos(angle) * distanceRatio,
    targetYRatio: Math.sin(angle) * distanceRatio,
    sizeRatio: (1.5 + ((i * 13) % 30) / 10) / 140,
    delay: 0.06 + (i / SPARK_COUNT) * 0.12,
    color: `hsl(${hue}, 100%, ${lightness}%)`,
  };
});

// ─── Sub-components ──────────────────────────────────────────────────────

/** Expanding shockwave ring from center (matches HTML @keyframes wolfWaveExpand) */
const WolfWave = React.memo(function WolfWave({
  startP,
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
  startP: number;
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
  // Wave base size: HTML 40px on 140px card → 0.28 ratio
  const size = cardWidth * 0.28;

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [startP, endP], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(
        lp,
        [0, 0.15, 0.5, 1],
        [peakOpacity, peakOpacity * 0.7, peakOpacity * 0.3, 0],
      ),
      transform: [{ scale: interpolate(lp, [0, 0.5, 1], [0, maxScale * 0.6, maxScale]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.waveBase,
        {
          top: centerY - size / 2,
          left: centerX - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: bw,
          borderColor: color,
          boxShadow: `0 0 8px 2px ${color}`,
        },
        animStyle,
      ]}
    />
  );
});

/** Wolf eyes flash — two red ellipses (matches HTML @keyframes eyesFlash) */
const WolfEyes = React.memo(function WolfEyes({
  progress,
  color,
  centerX,
  eyeY,
  cardWidth,
}: {
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  eyeY: number;
  cardWidth: number;
}) {
  // Eyes container width relative to cardWidth (HTML: 60px wide on 140px card → 0.429)
  const eyeWidth = cardWidth * 0.429;
  const eyeSize = cardWidth * 0.071;
  const eyeHeight = cardWidth * 0.043;

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // HTML: 0%→0, 10%→1, 25%→1, 40%→0.1, 45%→0.9, 60%→0, 100%→0
    return {
      opacity: interpolate(
        p,
        [0.08, 0.12, 0.25, 0.35, 0.38, 0.5, 1],
        [0, 1, 1, 0.1, 0.9, 0, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.eyesContainer,
        { top: eyeY, left: centerX - eyeWidth / 2, width: eyeWidth, height: eyeHeight * 2.4 },
        animStyle,
      ]}
    >
      <View
        style={[
          styles.wolfEye,
          {
            width: eyeSize,
            height: eyeHeight,
            borderRadius: eyeSize / 2,
            backgroundColor: color,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.071)}px ${Math.round(cardWidth * 0.021)}px ${color}`,
          },
        ]}
      />
      <View
        style={[
          styles.wolfEye,
          {
            width: eyeSize,
            height: eyeHeight,
            borderRadius: eyeSize / 2,
            backgroundColor: color,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.071)}px ${Math.round(cardWidth * 0.021)}px ${color}`,
          },
        ]}
      />
    </Animated.View>
  );
});

/** Spark fragment shooting outward from center (matches HTML spawnSparks) */
const WolfSpark = React.memo(function WolfSpark({
  targetXRatio,
  targetYRatio,
  sizeRatio,
  delay,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  targetXRatio: number;
  targetYRatio: number;
  sizeRatio: number;
  delay: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const targetX = targetXRatio * cardWidth;
  const targetY = targetYRatio * cardWidth;
  const size = Math.max(1, sizeRatio * cardWidth);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [delay, delay + 0.35], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(lp, [0, 0.05, 0.4, 1], [0, 1, 0.5, 0]),
      transform: [
        { translateX: interpolate(lp, [0, 1], [0, targetX]) },
        { translateY: interpolate(lp, [0, 1], [0, targetY]) },
        { scale: interpolate(lp, [0, 0.05, 1], [1, 1, 0]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.sparkBase,
        {
          top: centerY - size / 2,
          left: centerX - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${Math.round(cardWidth * 0.04)}px ${color}`,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Main component ──────────────────────────────────────────────────────

interface WolfRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const WolfRevealEffect: React.FC<WolfRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor: _particleColor,
}) => {
  const progress = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const cracksOpacity = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    // Transient effects progress: 0→1 over 2.5s
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow — matches HTML @keyframes wolfGlow
    // 0%→12% peak, 12%→35% medium, 35%→100% persist low
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 575, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1625, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Cracks appear at 0.2s then glow-pulse (matches HTML cracksAppear + cracksGlow)
    cracksOpacity.value = withDelay(
      200,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(
          800,
          withRepeat(
            withSequence(
              withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
          ),
        ),
      ),
    );
  }, [animate, progress, glowIntensity, cracksOpacity]);

  // Card glow wrapper
  const cardGlowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  // Flash overlay — strong initial burst matching HTML demo
  const flashStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.04, 0.12, 0.3], [0, 0.7, 0.25, 0], Extrapolation.CLAMP),
    };
  });

  // Bottom fog (matches HTML @keyframes fogRise — persistent)
  const fogStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0.16, 0.4, 1], [0, 0.8, 0.45], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0.16, 0.4, 1], [20, 0, -5], Extrapolation.CLAMP) }],
    };
  });

  // Cracks SVG brightness pulse
  const cracksStyle = useAnimatedStyle(() => ({
    opacity: cracksOpacity.value,
  }));

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]} pointerEvents="none">
      {/* Persistent card glow — matches HTML wolfGlow boxShadow */}
      <Animated.View
        style={[
          styles.cardGlow,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.357)}px ${Math.round(cardWidth * 0.143)}px ${glowColor}, 0 0 ${Math.round(cardWidth * 0.714)}px ${Math.round(cardWidth * 0.286)}px ${primaryColor}`,
          },
          cardGlowStyle,
        ]}
      />

      {/* Flash overlay */}
      <Animated.View style={[styles.flash, { backgroundColor: primaryColor }, flashStyle]} />

      {/* Bottom fog — gradient from dark red to transparent (matches HTML linear-gradient) */}
      <Animated.View style={[styles.fog, { height: cardHeight * 0.6 }, fogStyle]}>
        <LinearGradient
          colors={[`${primaryColor}00`, `${primaryColor}50`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Cracks SVG (matches HTML wolf-cracks + cracksGlow brightness pulse) */}
      <Animated.View
        style={[styles.cracksContainer, { width: cardWidth, height: cardHeight }, cracksStyle]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${Math.round(cardWidth)} ${Math.round(cardHeight)}`}
        >
          <Line
            x1={cardWidth * 0.32}
            y1={cardHeight * 0.05}
            x2={cardWidth * 0.36}
            y2={cardHeight * 0.28}
            stroke={`${primaryColor}99`}
            strokeWidth="1.5"
          />
          <Line
            x1={cardWidth * 0.36}
            y1={cardHeight * 0.28}
            x2={cardWidth * 0.27}
            y2={cardHeight * 0.46}
            stroke={`${primaryColor}80`}
            strokeWidth="1.2"
          />
          <Line
            x1={cardWidth * 0.36}
            y1={cardHeight * 0.28}
            x2={cardWidth * 0.46}
            y2={cardHeight * 0.41}
            stroke={`${primaryColor}66`}
            strokeWidth="1"
          />
          <Line
            x1={cardWidth * 0.64}
            y1={cardHeight * 0.08}
            x2={cardWidth * 0.61}
            y2={cardHeight * 0.31}
            stroke={`${primaryColor}8C`}
            strokeWidth="1.3"
          />
          <Line
            x1={cardWidth * 0.61}
            y1={cardHeight * 0.31}
            x2={cardWidth * 0.68}
            y2={cardHeight * 0.51}
            stroke={`${primaryColor}66`}
            strokeWidth="1"
          />
          <Line
            x1={cardWidth * 0.61}
            y1={cardHeight * 0.31}
            x2={cardWidth * 0.51}
            y2={cardHeight * 0.44}
            stroke={`${primaryColor}59`}
            strokeWidth="0.8"
          />
          <Line
            x1={cardWidth * 0.21}
            y1={cardHeight * 0.67}
            x2={cardWidth * 0.39}
            y2={cardHeight * 0.9}
            stroke={`${primaryColor}4D`}
            strokeWidth="1"
          />
          <Line
            x1={cardWidth * 0.71}
            y1={cardHeight * 0.72}
            x2={cardWidth * 0.57}
            y2={cardHeight * 0.95}
            stroke={`${primaryColor}4D`}
            strokeWidth="0.8"
          />
        </Svg>
      </Animated.View>

      {/* Shockwave rings (3 layers) — use primaryColor for higher contrast */}
      {WAVE_CONFIGS.map((cfg, i) => (
        <WolfWave
          key={i}
          {...cfg}
          progress={progress}
          color={primaryColor}
          centerX={centerX}
          centerY={centerY}
          cardWidth={cardWidth}
        />
      ))}

      {/* Wolf eyes */}
      <WolfEyes
        progress={progress}
        color={primaryColor}
        centerX={centerX}
        eyeY={cardHeight * 0.3}
        cardWidth={cardWidth}
      />

      {/* Spark fragments (24, matching HTML demo — hue-varied colors) */}
      {SPARKS.map((spark) => (
        <WolfSpark
          key={spark.index}
          targetXRatio={spark.targetXRatio}
          targetYRatio={spark.targetYRatio}
          sizeRatio={spark.sizeRatio}
          delay={spark.delay}
          progress={progress}
          color={spark.color}
          centerX={centerX}
          centerY={centerY}
          cardWidth={cardWidth}
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
  fog: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: borderRadius.medium,
    borderBottomRightRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  cracksContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  eyesContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wolfEye: {},
  waveBase: {
    position: 'absolute',
  },
  sparkBase: {
    position: 'absolute',
  },
});

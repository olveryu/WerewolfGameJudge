/**
 * ThirdRevealEffect - 第三方阵营揭示特效（Reanimated 4）
 *
 * 翻牌后在卡片区域渲染神秘系列动画，严格对标 HTML demo v2：
 * 1. **卡片光晕** — animated boxShadow 从极亮爆发→中等→**持续微弱紫色发光**
 * 2. 旋转虚线符文环（2 层）— 出现后持续旋转
 * 3. 漂浮符号（8 个）— 分布在环上，缓慢浮动
 * 4. 螺旋轨道粒子（8 颗）— 绕中心无限公转
 *
 * 符文环使用 react-native-svg 绘制虚线圆，旋转/浮动由 Reanimated 驱动。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import Svg, { Circle } from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const AE = CONFIG.alignmentEffects;

// ─── Pre-computed arrays ──────────────────────────────────────────────

const RUNE_SYMBOLS = ['✦', '⟡', '◇', '⊕', '☽', '✧', '⚝', '◈'];

const ORBIT_PARTICLES = Array.from({ length: AE.thirdParticleCount }, (_, i) => ({
  index: i,
  phaseOffset: (i / AE.thirdParticleCount) * 360,
  // Radius offset as ratio of ring radius (HTML: ±10px on ~60px ring ≈ ±0.17)
  radiusOffsetRatio: 0.17 * ((i % 3) - 1),
  sizeRatio: (2 + (i % 2)) / 140,
}));

// ─── Sub-components ──────────────────────────────────────────────────────

/** Floating rune symbol positioned around the ring (matches HTML .rune-symbol + runeFloat) */
const RuneSymbol = React.memo(function RuneSymbol({
  symbol,
  x,
  y,
  index,
  total,
  floatCycle,
  appear,
  color,
  symbolSize,
}: {
  symbol: string;
  x: number;
  y: number;
  index: number;
  total: number;
  floatCycle: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  symbolSize: number;
}) {
  const phaseOffset = (index / total) * Math.PI * 2;
  const halfSize = symbolSize / 2;

  const animStyle = useAnimatedStyle(() => {
    const floatY = Math.sin((floatCycle.value / 360) * Math.PI * 2 * 3 + phaseOffset) * 4;
    const symbolOpacity = interpolate(
      Math.sin((floatCycle.value / 360) * Math.PI * 2 * 3 + phaseOffset),
      [-1, 0, 1],
      [0.3, 0.5, 0.6],
    );
    return {
      opacity: appear.value * symbolOpacity,
      transform: [{ translateY: floatY }],
    };
  });

  return (
    <Animated.View
      style={[styles.runeSymbolContainer, { top: y - halfSize, left: x - halfSize }, animStyle]}
    >
      <Text style={[styles.runeSymbolText, { color, fontSize: symbolSize }]}>{symbol}</Text>
    </Animated.View>
  );
});

/** Orbiting particle around card center (matches HTML startThirdParticles) */
const OrbitParticle = React.memo(function OrbitParticle({
  phaseOffset,
  radiusOffsetRatio,
  sizeRatio,
  orbit,
  appear,
  color,
  centerX,
  centerY,
  baseRadius,
  cardWidth,
}: {
  phaseOffset: number;
  radiusOffsetRatio: number;
  sizeRatio: number;
  orbit: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  baseRadius: number;
  cardWidth: number;
}) {
  const radiusOffset = radiusOffsetRatio * baseRadius;
  const size = Math.max(1, sizeRatio * cardWidth);
  // Orbit wiggle amplitude: ~8px on 140px card → 0.057 ratio
  const wiggleAmp = cardWidth * 0.057;

  const animStyle = useAnimatedStyle(() => {
    const angleDeg = orbit.value + phaseOffset;
    const angleRad = (angleDeg * Math.PI) / 180;
    const r = baseRadius + radiusOffset + Math.sin(angleRad * 3) * wiggleAmp;
    return {
      opacity: appear.value * 0.7,
      transform: [
        { translateX: Math.cos(angleRad) * r + centerX - size / 2 },
        { translateY: Math.sin(angleRad) * r + centerY - size / 2 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.orbitParticle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${size * 3}px ${size}px ${color}40`,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Main component ──────────────────────────────────────────────────────

interface ThirdRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const ThirdRevealEffect: React.FC<ThirdRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const appear = useSharedValue(0);
  const ringScale = useSharedValue(0.5);
  const ringRotateOffset = useSharedValue(-30);
  const glowIntensity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const orbit = useSharedValue(0);
  const particleOrbit = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  // HTML: ring inset: -15px on 140px card → ring = 170px → 1.214 × cardWidth
  const ringSize = cardWidth * 1.214;
  const _ringRadius = ringSize / 2;

  useEffect(() => {
    if (!animate) return;

    // Fade in all elements (matches HTML runeAppear: 0.5s delay 0.3s ease-out)
    // HTML: opacity 0→0.6, scale 0.5→1, rotate -30°→0°
    appear.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    ringScale.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    ringRotateOffset.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow: peak → medium → persist
    // Matches HTML @keyframes thirdGlow: 0%→15%→40%→100%
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 625, easing: Easing.out(Easing.quad) }),
        withTiming(0.3, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Continuous outer ring rotation (matches HTML runeRotate: 12s linear infinite)
    rotation.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, { duration: AE.thirdRuneRotationDuration, easing: Easing.linear }),
        -1,
      ),
    );

    // Inner ring rotation: HTML 8s reverse (separate from orbit particles)
    // Note: orbit.value drives both inner ring reverse + orbit particles at different speeds
    // We reuse orbit for inner ring (8s) — orbit particles use their own phaseOffset math
    orbit.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, { duration: AE.thirdInnerRingDuration, easing: Easing.linear }),
        -1,
      ),
    );

    // Particle orbit: separate cycle for spiral particles
    particleOrbit.value = withDelay(
      AE.effectStartDelay,
      withRepeat(withTiming(360, { duration: AE.thirdOrbitDuration, easing: Easing.linear }), -1),
    );
  }, [animate, appear, ringScale, ringRotateOffset, glowIntensity, rotation, orbit, particleOrbit]);

  // Card glow wrapper
  const cardGlowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  // Flash overlay — stronger initial burst
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(appear.value, [0, 0.3, 1], [0, 0.55, 0], Extrapolation.CLAMP),
  }));

  // Outer rune ring (clockwise) — matches HTML runeAppear: scale 0.5→1, rotate -30→0
  const outerRotateStyle = useAnimatedStyle(() => ({
    opacity: appear.value * 0.8,
    transform: [
      { scale: ringScale.value },
      { rotate: `${ringRotateOffset.value + rotation.value}deg` },
    ],
  }));

  // Inner rune ring (counter-clockwise, HTML: 8s reverse)
  const innerRotateStyle = useAnimatedStyle(() => ({
    opacity: appear.value * 0.5,
    transform: [
      { scale: ringScale.value },
      { rotate: `${ringRotateOffset.value - orbit.value}deg` },
    ],
  }));

  // Pre-compute symbol positions (on the ring circumference)
  const symbolPositions = RUNE_SYMBOLS.map((sym, i) => {
    const angle = (i / RUNE_SYMBOLS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      symbol: sym,
      // HTML: rune symbols at r=72 on 140px card → 0.514 × cardWidth
      x: centerX + Math.cos(angle) * (cardWidth * 0.514),
      y: centerY + Math.sin(angle) * (cardWidth * 0.514),
    };
  });

  // HTML: inner ring inset 10px more → 150/170 ≈ 0.882
  const innerRingSize = ringSize * 0.882;

  // Rune symbol size: HTML 14px on 140px card → 0.10
  const symbolSize = Math.round(cardWidth * 0.1);

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]} pointerEvents="none">
      {/* Persistent card glow — matches HTML thirdGlow boxShadow */}
      <Animated.View
        style={[
          styles.cardGlow,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.25)}px ${Math.round(cardWidth * 0.086)}px ${glowColor}, 0 0 ${Math.round(cardWidth * 0.5)}px ${Math.round(cardWidth * 0.179)}px ${primaryColor}`,
          },
          cardGlowStyle,
        ]}
      />

      {/* Flash overlay */}
      <Animated.View style={[styles.flash, { backgroundColor: primaryColor }, flashStyle]} />

      {/* Outer rune ring */}
      <Animated.View
        style={[
          styles.ringContainer,
          {
            top: centerY - ringSize / 2,
            left: centerX - ringSize / 2,
            width: ringSize,
            height: ringSize,
          },
          outerRotateStyle,
        ]}
      >
        <Svg width={ringSize} height={ringSize}>
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringSize / 2 - 2}
            stroke={glowColor}
            strokeWidth={1}
            strokeDasharray="4 8"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Inner rune ring (counter-rotating) */}
      <Animated.View
        style={[
          styles.ringContainer,
          {
            top: centerY - innerRingSize / 2,
            left: centerX - innerRingSize / 2,
            width: innerRingSize,
            height: innerRingSize,
          },
          innerRotateStyle,
        ]}
      >
        <Svg width={innerRingSize} height={innerRingSize}>
          <Circle
            cx={innerRingSize / 2}
            cy={innerRingSize / 2}
            r={innerRingSize / 2 - 2}
            stroke={primaryColor}
            strokeWidth={1}
            strokeDasharray="2 6"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Rune symbols */}
      {symbolPositions.map(({ symbol, x, y }, i) => (
        <RuneSymbol
          key={i}
          symbol={symbol}
          x={x}
          y={y}
          index={i}
          total={RUNE_SYMBOLS.length}
          floatCycle={rotation}
          appear={appear}
          color={glowColor}
          symbolSize={symbolSize}
        />
      ))}

      {/* Orbit particles */}
      {ORBIT_PARTICLES.map(({ index, phaseOffset, radiusOffsetRatio, sizeRatio }) => (
        <OrbitParticle
          key={index}
          phaseOffset={phaseOffset}
          radiusOffsetRatio={radiusOffsetRatio}
          sizeRatio={sizeRatio}
          orbit={particleOrbit}
          appear={appear}
          color={particleColor}
          centerX={centerX}
          centerY={centerY}
          baseRadius={cardWidth * 0.35}
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
  ringContainer: {
    position: 'absolute',
  },
  runeSymbolContainer: {
    position: 'absolute',
  },
  runeSymbolText: {},
  orbitParticle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

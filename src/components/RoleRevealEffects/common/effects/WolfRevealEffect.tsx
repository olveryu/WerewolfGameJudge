/**
 * WolfRevealEffect — 狼人阵营揭示特效（SVG + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染暗红恐怖系列动画：
 * 1. 卡片辉光 — SVG RadialGradient + feGaussianBlur，从极亮爆发→持续微弱暗红发光
 * 2. 暗红雾气 — SVG 多层 Circle + feGaussianBlur 模拟干冰烟雾弥漫
 * 3. 血滴粒子 — 5 颗水滴形液滴从卡片顶部边缘加速滴落（带拖尾辉光）
 * 4. 裂痕网 — 从中心扩散的不规则裂纹 Path（strokeDashoffset 蔓延）
 * 5. 狼瞳脉冲 — 两只暗红光点在暗处脉动
 * 6. 暗色冲击波 — 2 层从中心扩散的扭曲波纹
 * 7. 火花碎片 — 24 颗从中心射出带 feGaussianBlur 的粒子
 *
 * 情绪签名：slow burn（缓慢升温的不安）。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Path as SvgPath,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvgPath = Animated.createAnimatedComponent(SvgPath);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ─── Pre-computed data ────────────────────────────────────────────────

const SPARK_COUNT = AE.wolfSparkCount;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 3) * 0.15;
  const distRatio = 0.28 + ((i * 37) % 100) / 140;
  const hue = (i * 17) % 40;
  const lightness = 50 + ((i * 13) % 30);
  return {
    targetXRatio: Math.cos(angle) * distRatio,
    targetYRatio: Math.sin(angle) * distRatio,
    sizeRatio: (1.5 + ((i * 13) % 30) / 10) / 140,
    delay: 0.06 + (i / SPARK_COUNT) * 0.12,
    color: `hsl(${hue}, 100%, ${lightness}%)`,
  };
});

// Blood drop seeds — fewer, larger, positioned near card edges for visual logic
const BLOOD_DROPS = [
  { xRatio: 0.12, size: 5.5, speed: 2800, delay: 0 },
  { xRatio: 0.88, size: 5, speed: 3200, delay: 400 },
  { xRatio: 0.28, size: 5, speed: 3600, delay: 800 },
  { xRatio: 0.72, size: 6, speed: 2600, delay: 1200 },
  { xRatio: 0.5, size: 5, speed: 3400, delay: 600 },
];

/** Teardrop SVG path centered at (0,0): narrow top, round bottom */
function buildTeardropPath(r: number): string {
  // Upper tip (narrow) → bulge at bottom
  const tipY = -r * 2.2;
  return (
    `M 0 ${tipY.toFixed(1)} ` +
    `Q ${(r * 0.4).toFixed(1)} ${(-r * 0.8).toFixed(1)} ${r.toFixed(1)} ${(r * 0.2).toFixed(1)} ` +
    `A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(-r).toFixed(1)} ${(r * 0.2).toFixed(1)} ` +
    `Q ${(-r * 0.4).toFixed(1)} ${(-r * 0.8).toFixed(1)} 0 ${tipY.toFixed(1)} Z`
  );
}

// Fog clouds — layered volumetric fog
const FOG_CLOUDS = [
  { xRatio: 0.25, yRatio: 0.7, rRatio: 0.45, driftX: 8, driftYAmp: 6, alphaRatio: 0.5 },
  { xRatio: 0.75, yRatio: 0.65, rRatio: 0.4, driftX: -10, driftYAmp: 5, alphaRatio: 0.45 },
  { xRatio: 0.5, yRatio: 0.8, rRatio: 0.5, driftX: 6, driftYAmp: 8, alphaRatio: 0.55 },
  { xRatio: 0.35, yRatio: 0.75, rRatio: 0.3, driftX: -12, driftYAmp: 4, alphaRatio: 0.6 },
  { xRatio: 0.65, yRatio: 0.85, rRatio: 0.35, driftX: 10, driftYAmp: 7, alphaRatio: 0.5 },
  { xRatio: 0.15, yRatio: 0.9, rRatio: 0.2, driftX: 15, driftYAmp: 10, alphaRatio: 0.7 },
  { xRatio: 0.85, yRatio: 0.78, rRatio: 0.22, driftX: -14, driftYAmp: 9, alphaRatio: 0.65 },
  { xRatio: 0.5, yRatio: 0.95, rRatio: 0.38, driftX: -5, driftYAmp: 6, alphaRatio: 0.4 },
];

// Crack paths — ratio coordinates (0–1), scaled via viewBox
const CRACK_MAIN = [
  'M 0.5 0.42 L 0.47 0.36 L 0.44 0.32 L 0.40 0.28 L 0.38 0.22 L 0.35 0.15 L 0.33 0.08',
  'M 0.5 0.42 L 0.53 0.37 L 0.57 0.33 L 0.60 0.27 L 0.63 0.20 L 0.66 0.12',
  'M 0.5 0.42 L 0.45 0.40 L 0.40 0.38 L 0.34 0.36 L 0.28 0.34 L 0.22 0.33',
  'M 0.5 0.42 L 0.55 0.41 L 0.60 0.39 L 0.66 0.40 L 0.72 0.38 L 0.78 0.37',
  'M 0.5 0.42 L 0.47 0.48 L 0.43 0.54 L 0.39 0.60 L 0.35 0.68 L 0.30 0.76',
  'M 0.5 0.42 L 0.54 0.47 L 0.58 0.53 L 0.62 0.60 L 0.67 0.68 L 0.72 0.78',
];
const CRACK_BRANCHES = [
  'M 0.44 0.32 L 0.41 0.30 L 0.37 0.29',
  'M 0.40 0.28 L 0.43 0.24 L 0.44 0.19',
  'M 0.57 0.33 L 0.60 0.31 L 0.64 0.30',
  'M 0.60 0.27 L 0.57 0.23 L 0.56 0.18',
  'M 0.40 0.38 L 0.38 0.42 L 0.34 0.44',
  'M 0.34 0.36 L 0.31 0.32 L 0.27 0.30',
  'M 0.60 0.39 L 0.62 0.43 L 0.66 0.45',
  'M 0.66 0.40 L 0.69 0.36 L 0.73 0.34',
  'M 0.43 0.54 L 0.40 0.56 L 0.36 0.55',
  'M 0.39 0.60 L 0.42 0.64 L 0.43 0.70',
  'M 0.58 0.53 L 0.61 0.55 L 0.65 0.54',
  'M 0.62 0.60 L 0.59 0.64 L 0.58 0.70',
];
const DEBRIS_CHIPS = [
  'M 0.42 0.29 L 0.46 0.26 L 0.41 0.26 Z',
  'M 0.38 0.23 L 0.42 0.20 L 0.36 0.21 Z',
  'M 0.57 0.30 L 0.61 0.27 L 0.56 0.28 Z',
  'M 0.61 0.23 L 0.65 0.20 L 0.60 0.21 Z',
  'M 0.37 0.36 L 0.41 0.33 L 0.36 0.34 Z',
  'M 0.62 0.37 L 0.66 0.34 L 0.61 0.35 Z',
  'M 0.41 0.54 L 0.45 0.51 L 0.40 0.52 Z',
  'M 0.58 0.54 L 0.62 0.51 L 0.57 0.52 Z',
];

// Pre-build teardrop path strings
const BLOOD_DROP_PATHS = BLOOD_DROPS.map((drop) => buildTeardropPath(drop.size));

// ─── Crack Background (renders BEHIND the role image) ─────────────────

interface WolfCrackBackgroundProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
}

/** Animated crack path with SVG strokeDashoffset to simulate Skia `end` */
const AnimatedCrackPath: React.FC<{
  pathStr: string;
  progress: SharedValue<number>;
  startThreshold: number;
  speedMultiplier: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  filterUrl?: string;
}> = React.memo(
  ({
    pathStr,
    progress,
    startThreshold,
    speedMultiplier,
    color,
    strokeWidth,
    opacity,
    filterUrl,
  }) => {
    const animatedProps = useAnimatedProps(() => {
      const raw = Math.min(1, Math.max(0, (progress.value - startThreshold) * speedMultiplier));
      return { strokeDashoffset: 1 - raw };
    });
    return (
      <AnimatedSvgPath
        d={pathStr}
        stroke={color}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        opacity={opacity}
        filter={filterUrl}
        animatedProps={animatedProps}
        {...{ pathLength: 1 }}
      />
    );
  },
);
AnimatedCrackPath.displayName = 'AnimatedCrackPath';

/**
 * WolfCrackBackground — 裂痕背景层（SVG）
 *
 * 渲染在角色图片之后（z-order 更低），模拟卡片从内部裂开、
 * 裂缝中透出暗红能量光的效果。使用 SVG viewBox 映射 0–1 坐标。
 */
export const WolfCrackBackground: React.FC<WolfCrackBackgroundProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
}) => {
  const crackSpread = useSharedValue(0);
  const crackOpacity = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    crackSpread.value = withDelay(
      AE.effectStartDelay + 100,
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
    );
    crackOpacity.value = withDelay(
      AE.effectStartDelay,
      withTiming(0.85, { duration: 1200, easing: Easing.out(Easing.quad) }),
    );
  }, [animate, crackSpread, crackOpacity]);

  const groupProps = useAnimatedProps(() => ({ opacity: crackOpacity.value }));
  const debrisProps = useAnimatedProps(() => ({
    opacity: Math.max(0, Math.min(0.7, (crackSpread.value - 0.4) * 2)),
  }));

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: cardWidth,
      height: cardHeight,
      pointerEvents: 'none' as const,
    }),
    [cardWidth, cardHeight],
  );

  // Scale factors for blur/stroke in viewBox 0-1 coords
  const invW = 1 / cardWidth;

  return (
    <Svg style={canvasStyle} width={cardWidth} height={cardHeight} viewBox="0 0 1 1">
      <Defs>
        <Filter id="crack-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={5 * invW} />
        </Filter>
        <Filter id="crack-edge-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={0.3 * invW} />
        </Filter>
        <Filter id="crack-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={0.6 * invW} />
        </Filter>
        <Filter id="crack-branch-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={0.4 * invW} />
        </Filter>
        <Filter id="debris-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={0.3 * invW} />
        </Filter>
      </Defs>

      <AnimatedG animatedProps={groupProps}>
        {/* Layer 1: Shadow/damage halo */}
        {CRACK_MAIN.map((pathStr, i) => (
          <AnimatedCrackPath
            key={`shadow-${i}`}
            pathStr={pathStr}
            progress={crackSpread}
            startThreshold={0}
            speedMultiplier={1.2}
            color="#1a0000"
            strokeWidth={6 * invW}
            opacity={0.6}
            filterUrl="url(#crack-shadow-blur)"
          />
        ))}

        {/* Layer 2: Crack edge */}
        {CRACK_MAIN.map((pathStr, i) => (
          <AnimatedCrackPath
            key={`edge-${i}`}
            pathStr={pathStr}
            progress={crackSpread}
            startThreshold={0}
            speedMultiplier={1.2}
            color={primaryColor}
            strokeWidth={1.8 * invW}
            opacity={1}
            filterUrl="url(#crack-edge-blur)"
          />
        ))}

        {/* Layer 3: Glow core */}
        {CRACK_MAIN.map((pathStr, i) => (
          <AnimatedCrackPath
            key={`glow-${i}`}
            pathStr={pathStr}
            progress={crackSpread}
            startThreshold={0}
            speedMultiplier={1.2}
            color="#661100"
            strokeWidth={0.8 * invW}
            opacity={0.7}
            filterUrl="url(#crack-glow-blur)"
          />
        ))}

        {/* Branch cracks — edge */}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <AnimatedCrackPath
            key={`branch-edge-${i}`}
            pathStr={pathStr}
            progress={crackSpread}
            startThreshold={0.3}
            speedMultiplier={1.8}
            color={primaryColor}
            strokeWidth={1.0 * invW}
            opacity={0.6}
            filterUrl="url(#crack-edge-blur)"
          />
        ))}
        {/* Branch cracks — glow */}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <AnimatedCrackPath
            key={`branch-glow-${i}`}
            pathStr={pathStr}
            progress={crackSpread}
            startThreshold={0.3}
            speedMultiplier={1.8}
            color="#661100"
            strokeWidth={0.5 * invW}
            opacity={0.4}
            filterUrl="url(#crack-branch-blur)"
          />
        ))}

        {/* Debris chips */}
        <AnimatedG animatedProps={debrisProps}>
          {DEBRIS_CHIPS.map((chipPath, i) => (
            <SvgPath
              key={`debris-${i}`}
              d={chipPath}
              fill={primaryColor}
              opacity={0.9}
              filter="url(#debris-blur)"
            />
          ))}
        </AnimatedG>
      </AnimatedG>
    </Svg>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────

/** Single fog cloud driven by shared fogDrift */
const FogCloud: React.FC<{
  index: number;
  fog: (typeof FOG_CLOUDS)[number];
  fogDrift: SharedValue<number>;
  appear: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  primaryColor: string;
}> = React.memo(({ index, fog, fogDrift, appear, cardWidth, cardHeight, primaryColor }) => {
  const r = fog.rRatio * cardWidth;
  const animatedProps = useAnimatedProps(() => {
    const cx = fog.xRatio * cardWidth + Math.sin(fogDrift.value * Math.PI * 2 + index) * fog.driftX;
    const cy =
      fog.yRatio * cardHeight +
      Math.cos(fogDrift.value * Math.PI * 2 * 0.7 + index * 1.3) * fog.driftYAmp;
    const opacity =
      appear.value *
      fog.alphaRatio *
      (0.8 + 0.2 * Math.sin(fogDrift.value * Math.PI * 2 * 0.5 + index * 2));
    return { cx, cy, opacity };
  });
  return (
    <AnimatedCircle
      r={r}
      fill={`${primaryColor}90`}
      filter="url(#fog-blur)"
      animatedProps={animatedProps}
    />
  );
});
FogCloud.displayName = 'FogCloud';

/** Single blood drop with streak and teardrop body */
const BloodDrop: React.FC<{
  index: number;
  drop: (typeof BLOOD_DROPS)[number];
  bloodCycle: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
}> = React.memo(({ index, drop, bloodCycle, cardWidth, cardHeight }) => {
  const cx = drop.xRatio * cardWidth;
  const streakW = drop.size * 0.6;
  const teardropD = BLOOD_DROP_PATHS[index];

  // Streak rect
  const streakProps = useAnimatedProps(() => {
    const timeMs = bloodCycle.value * 1000;
    const elapsed = Math.max(0, timeMs - drop.delay);
    const p = (elapsed % drop.speed) / drop.speed;
    const cy = p * cardHeight * 0.95;
    const streakH = Math.max(0, cy - drop.size * 2);
    let streakOp: number;
    if (p < 0.08) streakOp = 0;
    else if (p > 0.85) streakOp = Math.max(0, (1 - p) / 0.15) * 0.2;
    else streakOp = Math.min(0.2, (p - 0.08) * 0.8);
    return { height: streakH, opacity: streakOp };
  });

  // Teardrop body
  const dropProps = useAnimatedProps(() => {
    const timeMs = bloodCycle.value * 1000;
    const elapsed = Math.max(0, timeMs - drop.delay);
    const p = (elapsed % drop.speed) / drop.speed;
    const cy = p * cardHeight * 0.95;
    let dropOp: number;
    if (p < 0.05) dropOp = p / 0.05;
    else if (p > 0.85) dropOp = Math.max(0, (1 - p) / 0.15);
    else dropOp = 0.9;
    return { translateX: cx, translateY: cy, opacity: dropOp };
  });

  return (
    <G>
      <AnimatedRect
        x={cx - streakW / 2}
        y={0}
        width={streakW}
        fill="#cc1111"
        animatedProps={streakProps}
      />
      <AnimatedG animatedProps={dropProps}>
        <SvgPath d={teardropD} fill="#cc1111" />
      </AnimatedG>
    </G>
  );
});
BloodDrop.displayName = 'BloodDrop';

/** Single spark fragment */
const WolfSpark: React.FC<{
  spark: (typeof SPARKS)[number];
  progress: SharedValue<number>;
  centerX: number;
  centerY: number;
  cardWidth: number;
}> = React.memo(({ spark, progress, centerX, centerY, cardWidth }) => {
  const animatedProps = useAnimatedProps(() => {
    const targetX = spark.targetXRatio * cardWidth;
    const targetY = spark.targetYRatio * cardWidth;
    const size = Math.max(1, spark.sizeRatio * cardWidth);
    const lp = Math.min(1, Math.max(0, (progress.value - spark.delay) / 0.35));
    const cx = centerX + targetX * lp;
    const cy = centerY + targetY * lp;
    let opacity: number;
    if (lp < 0.05) opacity = lp / 0.05;
    else opacity = Math.max(0, 1 - (lp - 0.05) / 0.6);
    const r = size * Math.max(0, 1 - lp);
    return { cx, cy, r, opacity };
  });
  return (
    <AnimatedCircle fill={spark.color} filter="url(#spark-blur)" animatedProps={animatedProps} />
  );
});
WolfSpark.displayName = 'WolfSpark';

// ─── Main component ───────────────────────────────────────────────────

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
  const fogDrift = useSharedValue(0);
  const eyePulse = useSharedValue(0);
  const bloodCycle = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 575, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1625, easing: Easing.out(Easing.quad) }),
      ),
    );

    fogDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);

    eyePulse.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );

    bloodCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1),
    );
  }, [animate, progress, glowIntensity, fogDrift, eyePulse, bloodCycle]);

  // ── Animated props ──
  const glowGroupProps = useAnimatedProps(() => ({
    opacity: glowIntensity.value * 0.6,
  }));
  const glowCircleProps = useAnimatedProps(() => ({
    r: cardWidth * 0.6 * (0.5 + glowIntensity.value * 0.5),
  }));

  // Shockwave ring 1
  const wave1Props = useAnimatedProps(() => ({
    r: progress.value * cardWidth * 0.8,
    opacity: Math.max(0, 0.5 - progress.value * 0.7),
  }));
  // Shockwave ring 2
  const wave2Props = useAnimatedProps(() => ({
    r: Math.max(0, progress.value - 0.15) * cardWidth * 0.9,
    opacity: Math.max(0, 0.3 - Math.max(0, progress.value - 0.15) * 0.5),
  }));

  // Wolf eye pulse
  const eyeGroupProps = useAnimatedProps(() => ({
    opacity: 0.3 + eyePulse.value * 0.5,
  }));

  // Gradient stop colors
  const glowStop1 = `${primaryColor}60`;
  const glowStop2 = `${primaryColor}00`;
  const eyeStop = `${primaryColor}00`;

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      overflow: 'visible' as const,
      width: cardWidth,
      height: cardHeight,
      pointerEvents: 'none' as const,
    }),
    [cardWidth, cardHeight],
  );

  const eyeLeftCx = centerX - cardWidth * 0.12;
  const eyeRightCx = centerX + cardWidth * 0.12;
  const eyeY = cardHeight * 0.3;

  return (
    <Svg style={canvasStyle} width={cardWidth} height={cardHeight}>
      <Defs>
        <RadialGradient
          id="wolf-glow-grad"
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.6}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowColor} />
          <Stop offset="0.5" stopColor={glowStop1} />
          <Stop offset="1" stopColor={glowStop2} />
        </RadialGradient>
        <RadialGradient
          id="wolf-eye-l"
          cx={eyeLeftCx}
          cy={eyeY}
          r={12}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={primaryColor} />
          <Stop offset="1" stopColor={eyeStop} />
        </RadialGradient>
        <RadialGradient
          id="wolf-eye-r"
          cx={eyeRightCx}
          cy={eyeY}
          r={12}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={primaryColor} />
          <Stop offset="1" stopColor={eyeStop} />
        </RadialGradient>
        <Filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.glowBlur} />
        </Filter>
        <Filter id="fog-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={25} />
        </Filter>
        <Filter id="eye-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={8} />
        </Filter>
        <Filter id="wave-blur-1" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={4} />
        </Filter>
        <Filter id="wave-blur-2" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={3} />
        </Filter>
        <Filter id="spark-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur} />
        </Filter>
      </Defs>

      {/* Card glow — RadialGradient from center */}
      <AnimatedG animatedProps={glowGroupProps}>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#wolf-glow-grad)"
          filter="url(#glow-blur)"
          animatedProps={glowCircleProps}
        />
      </AnimatedG>

      {/* Fog clouds */}
      <G filter="url(#fog-blur)">
        {FOG_CLOUDS.map((fog, i) => (
          <FogCloud
            key={i}
            index={i}
            fog={fog}
            fogDrift={fogDrift}
            appear={glowIntensity}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            primaryColor={primaryColor}
          />
        ))}
      </G>

      {/* Blood drops */}
      <G>
        {BLOOD_DROPS.map((drop, i) => (
          <BloodDrop
            key={i}
            index={i}
            drop={drop}
            bloodCycle={bloodCycle}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
          />
        ))}
      </G>

      {/* Wolf eyes — two menacing red glows */}
      <AnimatedG animatedProps={eyeGroupProps}>
        <Circle cx={eyeLeftCx} cy={eyeY} r={5} fill="url(#wolf-eye-l)" filter="url(#eye-blur)" />
        <Circle cx={eyeRightCx} cy={eyeY} r={5} fill="url(#wolf-eye-r)" filter="url(#eye-blur)" />
      </AnimatedG>

      {/* Shockwave rings — expanding + fading */}
      <G>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="none"
          stroke={primaryColor}
          strokeWidth={2}
          filter="url(#wave-blur-1)"
          animatedProps={wave1Props}
        />
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="none"
          stroke={primaryColor}
          strokeWidth={1.5}
          filter="url(#wave-blur-2)"
          animatedProps={wave2Props}
        />
      </G>

      {/* Spark fragments */}
      <G>
        {SPARKS.map((spark, i) => (
          <WolfSpark
            key={i}
            spark={spark}
            progress={progress}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
          />
        ))}
      </G>
    </Svg>
  );
};

/**
 * WolfRevealEffect — 狼人阵营揭示特效（Skia + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染暗红恐怖系列动画：
 * 1. 卡片辉光 — Skia RadialGradient + Blur，从极亮爆发→持续微弱暗红发光
 * 2. 暗红雾气 — Skia 多层 Circle + Blur 模拟干冰烟雾弥漫
 * 3. 血滴粒子 — 5 颗水滴形液滴从卡片顶部边缘加速滴落（带拖尾辉光）
 * 4. 裂痕网 — 从中心扩散的不规则裂纹 Path（strokeDashoffset 蔓延）
 * 5. 狼瞳脉冲 — 两只暗红光点在暗处脉动
 * 6. 暗色冲击波 — 2 层从中心扩散的扭曲波纹
 * 7. 火花碎片 — 24 颗从中心射出带 Blur + blendMode 的粒子
 *
 * 情绪签名：slow burn（缓慢升温的不安）。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path as SkiaPath,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

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

// Fog clouds (large blurry circles)
const FOG_CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  xRatio: 0.1 + ((i * 67 + 23) % 80) / 100,
  yRatio: 0.5 + ((i * 41 + 7) % 50) / 100,
  rRatio: 0.15 + ((i * 29) % 15) / 100,
  driftX: ((i * 53) % 30) - 15,
}));

// Crack paths — jagged zigzag lines with branches (ratio coordinates 0–1)
// Main cracks: multi-segment polylines from center with irregular offsets
// Branch cracks: short forks splitting off from main crack midpoints
const CRACK_MAIN = [
  // Upper-left — jagged upward
  'M 0.5 0.42 L 0.47 0.36 L 0.44 0.32 L 0.40 0.28 L 0.38 0.22 L 0.35 0.15 L 0.33 0.08',
  // Upper-right — jagged upward
  'M 0.5 0.42 L 0.53 0.37 L 0.57 0.33 L 0.60 0.27 L 0.63 0.20 L 0.66 0.12',
  // Left — jagged horizontal-ish
  'M 0.5 0.42 L 0.45 0.40 L 0.40 0.38 L 0.34 0.36 L 0.28 0.34 L 0.22 0.33',
  // Right — jagged horizontal-ish
  'M 0.5 0.42 L 0.55 0.41 L 0.60 0.39 L 0.66 0.40 L 0.72 0.38 L 0.78 0.37',
  // Lower-left — jagged downward
  'M 0.5 0.42 L 0.47 0.48 L 0.43 0.54 L 0.39 0.60 L 0.35 0.68 L 0.30 0.76',
  // Lower-right — jagged downward
  'M 0.5 0.42 L 0.54 0.47 L 0.58 0.53 L 0.62 0.60 L 0.67 0.68 L 0.72 0.78',
];
const CRACK_BRANCHES = [
  // Branches forking off from main cracks
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

// Debris chips — small triangular fragments at crack junctions
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

// ─── Crack Background (renders BEHIND the role image) ─────────────────

interface WolfCrackBackgroundProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
}

/**
 * WolfCrackBackground — 裂痕背景层
 *
 * 渲染在角色图片之后（z-order 更低），模拟卡片从内部裂开、
 * 裂缝中透出暗红能量光的效果。独立 Canvas + 动画。
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

  const mainEnd = useDerivedValue(() => Math.min(1, crackSpread.value * 1.2));
  const branchEnd = useDerivedValue(() =>
    Math.max(0, Math.min(1, (crackSpread.value - 0.3) * 1.8)),
  );
  const debrisOp = useDerivedValue(() => Math.max(0, Math.min(0.7, (crackSpread.value - 0.4) * 2)));

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: cardWidth,
      height: cardHeight,
    }),
    [cardWidth, cardHeight],
  );

  return (
    <Canvas style={canvasStyle} pointerEvents="none">
      <Group
        opacity={crackOpacity}
        transform={[{ scaleX: cardWidth }, { scaleY: cardHeight }]}
        origin={vec(0, 0)}
      >
        {/* Layer 1: Shadow/damage halo — wide, dark, blurry */}
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-shadow-${i}`}
            path={pathStr}
            color="#1a0000"
            style="stroke"
            strokeWidth={6 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
            opacity={0.6}
          >
            <Blur blur={5 / cardWidth} />
          </SkiaPath>
        ))}

        {/* Layer 2: Crack edge — medium, primary color */}
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-edge-${i}`}
            path={pathStr}
            color={primaryColor}
            style="stroke"
            strokeWidth={1.8 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
          >
            <Blur blur={0.3 / cardWidth} />
          </SkiaPath>
        ))}

        {/* Layer 3: Glow core — muted dark red, no screen blend */}
        {CRACK_MAIN.map((pathStr, i) => (
          <SkiaPath
            key={`crack-glow-${i}`}
            path={pathStr}
            color="#661100"
            style="stroke"
            strokeWidth={0.8 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={mainEnd}
            opacity={0.7}
          >
            <Blur blur={0.6 / cardWidth} />
          </SkiaPath>
        ))}

        {/* Branch cracks — 2-layer (edge + glow) */}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <SkiaPath
            key={`crack-b-edge-${i}`}
            path={pathStr}
            color={primaryColor}
            style="stroke"
            strokeWidth={1.0 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={branchEnd}
            opacity={0.6}
          >
            <Blur blur={0.3 / cardWidth} />
          </SkiaPath>
        ))}
        {CRACK_BRANCHES.map((pathStr, i) => (
          <SkiaPath
            key={`crack-b-glow-${i}`}
            path={pathStr}
            color="#661100"
            style="stroke"
            strokeWidth={0.5 / cardWidth}
            strokeCap="round"
            strokeJoin="round"
            end={branchEnd}
            opacity={0.4}
          >
            <Blur blur={0.4 / cardWidth} />
          </SkiaPath>
        ))}

        {/* Debris chips — triangular fragments at junctions */}
        <Group opacity={debrisOp}>
          {DEBRIS_CHIPS.map((chipPath, i) => (
            <SkiaPath key={`debris-${i}`} path={chipPath} color={primaryColor} opacity={0.9}>
              <Blur blur={0.3 / cardWidth} />
            </SkiaPath>
          ))}
        </Group>
      </Group>
    </Canvas>
  );
};

// ─── Sub-components (Skia nodes) ──────────────────────────────────────

/** Single fog cloud — extracted to avoid hooks inside .map() */
interface SkiaFogCloudProps {
  fog: (typeof FOG_CLOUDS)[number];
  index: number;
  fogDrift: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  color: string;
}

const SkiaFogCloud: React.FC<SkiaFogCloudProps> = React.memo(
  ({ fog, index, fogDrift, cardWidth, cardHeight, color }) => {
    const fogCx = useDerivedValue(
      () => fog.xRatio * cardWidth + Math.sin(fogDrift.value * Math.PI * 2 + index) * fog.driftX,
    );
    const fogCy = useDerivedValue(() => fog.yRatio * cardHeight);
    return (
      <Circle cx={fogCx} cy={fogCy} r={fog.rRatio * cardWidth} color={color}>
        <Blur blur={20} />
      </Circle>
    );
  },
);
SkiaFogCloud.displayName = 'SkiaFogCloud';

/** Wolf spark particle with Blur + blendMode */
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

  const cx = useDerivedValue(
    () => centerX + targetX * Math.min(1, Math.max(0, (progress.value - delay) / 0.35)),
  );
  const cy = useDerivedValue(
    () => centerY + targetY * Math.min(1, Math.max(0, (progress.value - delay) / 0.35)),
  );
  const opacity = useDerivedValue(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - delay) / 0.35));
    if (lp < 0.05) return lp / 0.05;
    return Math.max(0, 1 - (lp - 0.05) / 0.6);
  });
  const r = useDerivedValue(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - delay) / 0.35));
    return size * Math.max(0, 1 - lp);
  });

  return (
    <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity}>
      <Blur blur={SK.particleBlur} />
    </Circle>
  );
});

/** Blood drop — teardrop Path + blood trail streak + trailing glow, falling with gravity */
const BloodDrop = React.memo(function BloodDrop({
  xRatio,
  size,
  dropProgress,
  color,
  cardWidth,
  cardHeight,
}: {
  xRatio: number;
  size: number;
  dropProgress: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const dropPath = useMemo(() => buildTeardropPath(size), [size]);
  const cx = xRatio * cardWidth;
  const streakWidth = size * 0.6;

  // Current Y position (top → 95% of card height)
  const cy = useDerivedValue(() => dropProgress.value * cardHeight * 0.95);

  // Blood streak height — from origin to slightly above the drop
  const streakHeight = useDerivedValue(() => Math.max(0, cy.value - size * 2));

  // Streak opacity — appears after the drop has traveled a bit, fades with drop
  const streakOpacity = useDerivedValue(() => {
    const p = dropProgress.value;
    if (p < 0.08) return 0;
    if (p > 0.85) return Math.max(0, (1 - p) / 0.15) * 0.2;
    return Math.min(0.2, (p - 0.08) * 0.8);
  });

  // Drop opacity: fade in quickly, solid mid-fall, fade out at bottom
  const dropOpacity = useDerivedValue(() => {
    const p = dropProgress.value;
    if (p < 0.05) return p / 0.05;
    if (p > 0.85) return Math.max(0, (1 - p) / 0.15);
    return 0.9;
  });

  // Transform for teardrop path (translate to current position)
  const dropTransform = useDerivedValue(() => [{ translateX: cx }, { translateY: cy.value }]);

  return (
    <Group>
      {/* Blood trail streak — vertical smear left behind by the drop */}
      <Group opacity={streakOpacity}>
        <Rect
          x={cx - streakWidth / 2}
          y={0}
          width={streakWidth}
          height={streakHeight}
          color={color}
        >
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, cardHeight * 0.6)}
            colors={[`${color}00`, `${color}40`, color]}
          />
        </Rect>
        {/* Softer glow around the streak */}
        <Rect
          x={cx - streakWidth}
          y={0}
          width={streakWidth * 2}
          height={streakHeight}
          color={color}
          opacity={0.1}
        >
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, cardHeight * 0.6)}
            colors={[`${color}00`, `${color}20`, `${color}40`]}
          />
          <Blur blur={4} />
        </Rect>
      </Group>
      {/* Teardrop body */}
      <Group opacity={dropOpacity} transform={dropTransform}>
        <SkiaPath path={dropPath} color={color} />
        <SkiaPath path={dropPath} color={color} opacity={0.5}>
          <Blur blur={4} />
        </SkiaPath>
      </Group>
    </Group>
  );
});

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
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  // Blood drop shared values (one per drop)
  const dropSV0 = useSharedValue(0);
  const dropSV1 = useSharedValue(0);
  const dropSV2 = useSharedValue(0);
  const dropSV3 = useSharedValue(0);
  const dropSV4 = useSharedValue(0);
  const dropSVs = useMemo(
    () => [dropSV0, dropSV1, dropSV2, dropSV3, dropSV4],
    [dropSV0, dropSV1, dropSV2, dropSV3, dropSV4],
  );

  useEffect(() => {
    if (!animate) return;

    // Transient effects progress
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow — burst then persist
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 575, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1625, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Fog drift — continuous
    fogDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);

    // Wolf eye pulse — continuous menacing throb
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

    // Blood drops — staggered falling loops
    dropSVs.forEach((sv, i) => {
      sv.value = withDelay(
        AE.effectStartDelay + BLOOD_DROPS[i].delay,
        withRepeat(
          withTiming(1, { duration: BLOOD_DROPS[i].speed, easing: Easing.in(Easing.quad) }),
          -1,
        ),
      );
    });
  }, [animate, progress, glowIntensity, fogDrift, eyePulse, dropSVs]);

  // ── Derived values ──
  const glowR = useDerivedValue(() => cardWidth * 0.6 * (0.5 + glowIntensity.value * 0.5));
  const glowOpacity = useDerivedValue(() => glowIntensity.value * 0.6);

  // Shockwave rings
  const wave1R = useDerivedValue(() => progress.value * cardWidth * 0.8);
  const wave1Op = useDerivedValue(() => Math.max(0, 0.5 - progress.value * 0.7));
  const wave2R = useDerivedValue(() => Math.max(0, progress.value - 0.15) * cardWidth * 0.9);
  const wave2Op = useDerivedValue(() =>
    Math.max(0, 0.3 - Math.max(0, progress.value - 0.15) * 0.5),
  );

  // Eye pulse opacity
  const eyeOpacity = useDerivedValue(() => 0.3 + eyePulse.value * 0.5);

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      overflow: 'visible' as const,
      width: cardWidth,
      height: cardHeight,
    }),
    [cardWidth, cardHeight],
  );

  return (
    <Canvas style={canvasStyle} pointerEvents="none">
      {/* Card glow — RadialGradient from center */}
      <Group opacity={glowOpacity}>
        <Circle cx={centerX} cy={centerY} r={glowR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={cardWidth * 0.6}
            colors={[glowColor, `${primaryColor}60`, `${primaryColor}00`]}
          />
          <Blur blur={SK.glowBlur} />
        </Circle>
      </Group>

      {/* Fog clouds — large blurry circles drifting */}
      <Group opacity={0.35}>
        {FOG_CLOUDS.map((fog, i) => (
          <SkiaFogCloud
            key={`fog-${i}`}
            fog={fog}
            index={i}
            fogDrift={fogDrift}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            color={primaryColor}
          />
        ))}
      </Group>

      {/* Blood drops — teardrop shapes with trailing glow */}
      <Group>
        {BLOOD_DROPS.map((drop, i) => (
          <BloodDrop
            key={`blood-${i}`}
            xRatio={drop.xRatio}
            size={drop.size}
            dropProgress={dropSVs[i]}
            color="#cc1111"
            cardWidth={cardWidth}
            cardHeight={cardHeight}
          />
        ))}
      </Group>

      {/* Wolf eyes — two menacing red glows */}
      <Group opacity={eyeOpacity} blendMode="screen">
        <Circle cx={centerX - cardWidth * 0.12} cy={cardHeight * 0.3} r={5}>
          <RadialGradient
            c={vec(centerX - cardWidth * 0.12, cardHeight * 0.3)}
            r={12}
            colors={[primaryColor, `${primaryColor}00`]}
          />
          <Blur blur={8} />
        </Circle>
        <Circle cx={centerX + cardWidth * 0.12} cy={cardHeight * 0.3} r={5}>
          <RadialGradient
            c={vec(centerX + cardWidth * 0.12, cardHeight * 0.3)}
            r={12}
            colors={[primaryColor, `${primaryColor}00`]}
          />
          <Blur blur={8} />
        </Circle>
      </Group>

      {/* Shockwave rings — expanding + fading */}
      <Group blendMode="screen">
        <Circle
          cx={centerX}
          cy={centerY}
          r={wave1R}
          color={primaryColor}
          style="stroke"
          strokeWidth={2}
          opacity={wave1Op}
        >
          <Blur blur={4} />
        </Circle>
        <Circle
          cx={centerX}
          cy={centerY}
          r={wave2R}
          color={primaryColor}
          style="stroke"
          strokeWidth={1.5}
          opacity={wave2Op}
        >
          <Blur blur={3} />
        </Circle>
      </Group>

      {/* Spark fragments — 24 particles radiating outward */}
      <Group blendMode="screen">
        {SPARKS.map((spark, i) => (
          <WolfSpark
            key={`spark-${i}`}
            {...spark}
            progress={progress}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
          />
        ))}
      </Group>
    </Canvas>
  );
};

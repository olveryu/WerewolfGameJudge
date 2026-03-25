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
  Path as SkiaPath,
  RadialGradient,
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
  { xRatio: 0.12, size: 5, speed: 2800, delay: 0 },
  { xRatio: 0.88, size: 4.5, speed: 3200, delay: 400 },
  { xRatio: 0.28, size: 4, speed: 3600, delay: 800 },
  { xRatio: 0.72, size: 5.5, speed: 2600, delay: 1200 },
  { xRatio: 0.5, size: 4, speed: 3400, delay: 600 },
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

// Crack paths (pre-computed SVG path strings as ratios)
const CRACK_PATHS = [
  'M 0.5 0.42 L 0.32 0.05',
  'M 0.5 0.42 L 0.68 0.08',
  'M 0.5 0.42 L 0.2 0.35',
  'M 0.5 0.42 L 0.8 0.38',
  'M 0.5 0.42 L 0.25 0.7',
  'M 0.5 0.42 L 0.75 0.72',
  'M 0.5 0.42 L 0.35 0.9',
  'M 0.5 0.42 L 0.65 0.95',
];

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

/** Blood drop — teardrop Path + trailing glow, falling with gravity */
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

  // Current Y position (top → 95% of card height)
  const cy = useDerivedValue(() => dropProgress.value * cardHeight * 0.95);

  // Trail Y — slightly behind the drop
  const trailCy = useDerivedValue(() => Math.max(0, cy.value - size * 3.5));
  const trailR = size * 0.6;

  // Drop opacity: fade in quickly, solid mid-fall, fade out at bottom
  const dropOpacity = useDerivedValue(() => {
    const p = dropProgress.value;
    if (p < 0.05) return p / 0.05;
    if (p > 0.85) return Math.max(0, (1 - p) / 0.15);
    return 0.9;
  });

  // Trail opacity: dimmer than drop, fades with it
  const trailOpacity = useDerivedValue(() => dropOpacity.value * 0.4);

  // Transform for teardrop path (translate to current position)
  const dropTransform = useDerivedValue(() => [{ translateX: cx }, { translateY: cy.value }]);

  return (
    <Group>
      {/* Trailing glow streak */}
      <Group opacity={trailOpacity}>
        <Circle cx={cx} cy={trailCy} r={trailR} color={color}>
          <Blur blur={6} />
        </Circle>
        <Circle cx={cx} cy={trailCy} r={trailR * 1.8} color={color} opacity={0.3}>
          <Blur blur={12} />
        </Circle>
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

  // Crack path opacity (appears with progress)
  const crackOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.1) return 0;
    return Math.min(0.8, (p - 0.1) * 2);
  });

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

      {/* Crack network — paths from center outward */}
      <Group
        opacity={crackOpacity}
        transform={[{ scaleX: cardWidth }, { scaleY: cardHeight }]}
        origin={vec(0, 0)}
      >
        {CRACK_PATHS.map((pathStr, i) => (
          <SkiaPath
            key={`crack-${i}`}
            path={pathStr}
            color={primaryColor}
            style="stroke"
            strokeWidth={1.5 / cardWidth}
            strokeCap="round"
          >
            <Blur blur={1 / cardWidth} />
          </SkiaPath>
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

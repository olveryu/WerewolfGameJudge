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
  Paint,
  Path as SkiaPath,
  Picture,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
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

// Fog clouds — layered volumetric fog with RadialGradient for soft edges
const FOG_CLOUDS = [
  // Large background layers (slow drift, low opacity set via alphaRatio)
  { xRatio: 0.25, yRatio: 0.7, rRatio: 0.45, driftX: 8, driftYAmp: 6, alphaRatio: 0.5 },
  { xRatio: 0.75, yRatio: 0.65, rRatio: 0.4, driftX: -10, driftYAmp: 5, alphaRatio: 0.45 },
  { xRatio: 0.5, yRatio: 0.8, rRatio: 0.5, driftX: 6, driftYAmp: 8, alphaRatio: 0.55 },
  // Medium mid-ground layers
  { xRatio: 0.35, yRatio: 0.75, rRatio: 0.3, driftX: -12, driftYAmp: 4, alphaRatio: 0.6 },
  { xRatio: 0.65, yRatio: 0.85, rRatio: 0.35, driftX: 10, driftYAmp: 7, alphaRatio: 0.5 },
  // Small wisps (faster drift, higher alpha)
  { xRatio: 0.15, yRatio: 0.9, rRatio: 0.2, driftX: 15, driftYAmp: 10, alphaRatio: 0.7 },
  { xRatio: 0.85, yRatio: 0.78, rRatio: 0.22, driftX: -14, driftYAmp: 9, alphaRatio: 0.65 },
  { xRatio: 0.5, yRatio: 0.95, rRatio: 0.38, driftX: -5, driftYAmp: 6, alphaRatio: 0.4 },
];

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

// ── Immediate-mode Skia resources (reused across frames) ──
const sparkRecorder = Skia.PictureRecorder();
const sparkPaint = Skia.Paint();
const fogRecorder = Skia.PictureRecorder();
const fogPaint = Skia.Paint();
const bloodRecorder = Skia.PictureRecorder();
const bloodPaint = Skia.Paint();

// Pre-built teardrop paths for each blood drop size
const BLOOD_DROP_PATHS = BLOOD_DROPS.map(
  (drop) => Skia.Path.MakeFromSVGString(buildTeardropPath(drop.size))!,
);

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

    // Blood drops — single cycle driver (each drop derives its own phase via delay/speed)
    bloodCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1),
    );
  }, [animate, progress, glowIntensity, fogDrift, eyePulse, bloodCycle]);

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

  // ── Fog clouds: Immediate Mode via Picture API ──
  // Replaces 8 SkiaFogCloud components (24 useDerivedValue per frame) with 1.
  const fogPicture = useDerivedValue(() => {
    'worklet';
    const c = fogRecorder.beginRecording(Skia.XYWHRect(0, 0, cardWidth, cardHeight));
    const skColor = Skia.Color(primaryColor);
    for (let i = 0; i < FOG_CLOUDS.length; i++) {
      const fog = FOG_CLOUDS[i];
      const r = fog.rRatio * cardWidth;
      const cx = fog.xRatio * cardWidth + Math.sin(fogDrift.value * Math.PI * 2 + i) * fog.driftX;
      const cy =
        fog.yRatio * cardHeight +
        Math.cos(fogDrift.value * Math.PI * 2 * 0.7 + i * 1.3) * fog.driftYAmp;
      const opacity =
        fog.alphaRatio * (0.8 + 0.2 * Math.sin(fogDrift.value * Math.PI * 2 * 0.5 + i * 2));
      fogPaint.setColor(skColor);
      fogPaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, r, fogPaint);
    }
    return fogRecorder.finishRecordingAsPicture();
  });

  // ── Blood drops: Immediate Mode via Picture API ──
  // Replaces 5 BloodDrop components (25 useDerivedValue + 5 useSharedValue) with 1.
  // Each drop derives its own progress from the shared bloodCycle using its speed/delay.
  const bloodPicture = useDerivedValue(() => {
    'worklet';
    const c = bloodRecorder.beginRecording(Skia.XYWHRect(0, 0, cardWidth, cardHeight));
    const skColor = Skia.Color('#cc1111');
    // bloodCycle runs 0→1 every 1000ms; each drop has its own period
    // We use modular time to derive independent drop positions
    const timeMs = bloodCycle.value * 1000;

    for (let i = 0; i < BLOOD_DROPS.length; i++) {
      const drop = BLOOD_DROPS[i];
      const cx = drop.xRatio * cardWidth;
      const streakW = drop.size * 0.6;

      // Each drop loops at its own speed; offset by delay
      const elapsed = Math.max(0, timeMs - drop.delay);
      const p = (elapsed % drop.speed) / drop.speed;

      // Current Y position (top → 95% of card height)
      const cy = p * cardHeight * 0.95;

      // Blood streak — gradient approximation via variable alpha
      const streakH = Math.max(0, cy - drop.size * 2);
      let streakOp: number;
      if (p < 0.08) streakOp = 0;
      else if (p > 0.85) streakOp = Math.max(0, (1 - p) / 0.15) * 0.2;
      else streakOp = Math.min(0.2, (p - 0.08) * 0.8);

      if (streakH > 0 && streakOp > 0) {
        bloodPaint.setColor(skColor);
        bloodPaint.setAlphaf(streakOp);
        c.drawRect(Skia.XYWHRect(cx - streakW / 2, 0, streakW, streakH), bloodPaint);
      }

      // Teardrop body
      let dropOp: number;
      if (p < 0.05) dropOp = p / 0.05;
      else if (p > 0.85) dropOp = Math.max(0, (1 - p) / 0.15);
      else dropOp = 0.9;

      if (dropOp > 0) {
        const path = BLOOD_DROP_PATHS[i];
        c.save();
        c.translate(cx, cy);
        bloodPaint.setColor(skColor);
        bloodPaint.setAlphaf(dropOp);
        c.drawPath(path, bloodPaint);
        c.restore();
      }
    }
    return bloodRecorder.finishRecordingAsPicture();
  });

  // ── Spark fragments: Immediate Mode via Picture API ──
  // Replaces 24 WolfSpark components (96 useDerivedValue per frame) with 1.
  const sparkPicture = useDerivedValue(() => {
    'worklet';
    const c = sparkRecorder.beginRecording(Skia.XYWHRect(0, 0, cardWidth, cardHeight));
    for (let i = 0; i < SPARKS.length; i++) {
      const s = SPARKS[i];
      const targetX = s.targetXRatio * cardWidth;
      const targetY = s.targetYRatio * cardWidth;
      const size = Math.max(1, s.sizeRatio * cardWidth);
      const lp = Math.min(1, Math.max(0, (progress.value - s.delay) / 0.35));
      const cx = centerX + targetX * lp;
      const cy = centerY + targetY * lp;
      let opacity: number;
      if (lp < 0.05) opacity = lp / 0.05;
      else opacity = Math.max(0, 1 - (lp - 0.05) / 0.6);
      const r = size * Math.max(0, 1 - lp);
      if (r <= 0 || opacity <= 0) continue;
      const skColor = Skia.Color(s.color);
      sparkPaint.setColor(skColor);
      sparkPaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, r, sparkPaint);
    }
    return sparkRecorder.finishRecordingAsPicture();
  });

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

      {/* Fog clouds — Picture API with group-level blur (replaces 8 SkiaFogCloud) */}
      <Group
        layer={
          <Paint>
            <Blur blur={25} />
          </Paint>
        }
      >
        <Picture picture={fogPicture} />
      </Group>

      {/* Blood drops — Picture API (replaces 5 BloodDrop components) */}
      <Group>
        <Picture picture={bloodPicture} />
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

      {/* Spark fragments — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={SK.particleBlur} />
          </Paint>
        }
      >
        <Picture picture={sparkPicture} />
      </Group>
    </Canvas>
  );
};

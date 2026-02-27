/**
 * GodRevealEffect - 神职阵营揭示特效（Reanimated 4）
 *
 * 翻牌后在卡片区域渲染圣光系列动画，严格对标 HTML demo v2：
 * 1. **卡片光晕** — animated boxShadow 从极亮爆发→中等→**持续微弱发光**（不消失）
 * 2. 光芒十字 — 横/纵两道 LinearGradient 光线爆开后淡出（中间亮两端透明）
 * 3. 放射状射线（16 条）— 从中心射出后淡出
 * 4. 扩散光环（3 层）— 依次从中心扩散后淡出
 * 5. 粒子雨（40 颗）— 随机分布全卡面，缓慢上飘 + sin 闪烁
 *
 * 除卡片光晕外所有子元素均为瞬态（2.5s 内完成），粒子雨持续~5.5s，光晕持续保留。
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

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const AE = CONFIG.alignmentEffects;

// ─── Pre-computed arrays (module-level, stable) ──────────────────────────

const RAY_COUNT = 16;
// Pre-compute per-ray random width (1-3px) and opacity (0.3-0.8) matching HTML demo
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => ({
  angle: (i * 360) / RAY_COUNT,
  /** Width ratio relative to cardWidth (HTML 1-3px on 140px card → 0.007-0.021) */
  widthRatio: (1 + ((i * 7 + 3) % 20) / 10) / 140,
  opacity: 0.3 + ((i * 11 + 5) % 50) / 100, // 0.3-0.8 pseudo-random
  /** Per-ray stagger as progress fraction (HTML: animationDelay 0.25+i*0.03s on 2.5s total) */
  delayP: (0.25 + i * 0.03) / 2.5,
}));

/**
 * Halo timing from HTML demo:
 *  halo-1: 60px, delay 0.15s, duration 1.0s, border 2px
 *  halo-2: 80px, delay 0.30s, duration 1.2s, border 2px
 *  halo-3: 100px, delay 0.45s, duration 1.4s, border 1px
 *  On 2.5s progress: startP = delay/2.5, durationP = duration/2.5
 */
const HALO_CONFIGS = [
  { sizeRatio: 60 / 140, startP: 0.06, durationP: 0.4, bw: 2 },
  { sizeRatio: 80 / 140, startP: 0.12, durationP: 0.48, bw: 2 },
  { sizeRatio: 100 / 140, startP: 0.18, durationP: 0.56, bw: 1 },
] as const;

/**
 * Particles: random distribution across card, slow upward drift + twinkle.
 * Matches HTML demo startGodParticles canvas:
 *   x: random * 140, y: random * 195
 *   vx: (random-0.5)*0.8, vy: -0.3 - random*1.2
 *   size: 1 + random*2.5, alpha: 0.3 + random*0.7
 *   life: 1 → -0.003/frame (dies at frame ~333 ≈ 5.5s)
 *   twinkle: random phase + 0.1/frame → sin cycle ~1047ms
 */
const PARTICLE_LIFE_FRAMES = 333;
const GOD_PARTICLES = Array.from({ length: AE.godParticleCount }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  const r4 = ((i * 37 + 53) % 100) / 100;
  const r5 = ((i * 83 + 11) % 100) / 100;
  const r6 = ((i * 29 + 43) % 100) / 100;
  return {
    index: i,
    startXRatio: r1,
    startYRatio: r2,
    driftXRatio: ((r3 - 0.5) * 0.8 * PARTICLE_LIFE_FRAMES) / 140,
    driftYRatio: ((-0.3 - r4 * 1.2) * PARTICLE_LIFE_FRAMES) / 195,
    sizeRatio: (1 + r5 * 2.5) / 140,
    baseAlpha: 0.3 + r6 * 0.7,
    twinklePhase: ((i * 67 + 23) % 628) / 100,
  };
});

/** Twinkle cycle: demo increments 0.1/frame at 60fps → period = 2π / (0.1*60) ≈ 1047ms */
const TWINKLE_CYCLE_MS = 1047;
/** Particle total lifetime: ~333 frames at 60fps */
const PARTICLE_LIFETIME_MS = 5550;
/** Particle start delay: demo setTimeout(draw, 400) */
const PARTICLE_START_DELAY_MS = 400;

// ─── Sub-components ──────────────────────────────────────────────────────

/** Single light ray radiating outward from center (matches HTML .god-ray) */
const GodRay = React.memo(function GodRay({
  angle,
  rayWidth,
  rayOpacity,
  delayP,
  progress,
  color,
  centerX,
  centerY,
  cardHeight,
}: {
  angle: number;
  rayWidth: number;
  rayOpacity: number;
  /** Per-ray stagger delay as progress fraction (HTML: 0.25s + i*0.03s on 2.5s total) */
  delayP: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardHeight: number;
}) {
  // HTML: ray shoots to 160→200px on 195px card ≈ 0.82→1.03 of cardHeight
  const maxH1 = cardHeight * 0.82;
  const maxH2 = cardHeight * 1.03;

  // HTML: each ray has animationDelay = 0.25 + i*0.03s, animation duration 1.2s
  // On a 2.5s progress, the end of each ray = delayP + 1.2/2.5 ≈ delayP + 0.48
  const rayEnd = Math.min(delayP + 0.48, 1);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [delayP, rayEnd], [0, 1], Extrapolation.CLAMP);
    // Per-ray ease-out matching HTML: animation: rayShoot 1.2s ease-out
    const eased = 1 - (1 - lp) * (1 - lp);
    return {
      height: interpolate(eased, [0, 0.4, 1], [0, maxH1, maxH2]),
      opacity: interpolate(eased, [0, 0.02, 0.4, 1], [0, rayOpacity, rayOpacity * 0.6, 0]),
    };
  });

  return (
    <View
      style={[
        styles.rayWrapper,
        {
          top: centerY,
          left: centerX - rayWidth / 2,
          width: rayWidth,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.rayInner,
          styles.rayOverflowHidden,
          { width: rayWidth, borderRadius: rayWidth / 2 },
          animStyle,
        ]}
      >
        <LinearGradient
          colors={[`${color}00`, `${color}CC`]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

/** Expanding halo ring from center (matches HTML .god-halo + @keyframes haloExpand) */
const GodHalo = React.memo(function GodHalo({
  sizeRatio,
  startP,
  durationP,
  bw,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  sizeRatio: number;
  startP: number;
  durationP: number;
  bw: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const size = cardWidth * sizeRatio;
  const endP = startP + durationP;

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [startP, endP], [0, 1], Extrapolation.CLAMP);
    // Apply ease-out curve on local progress to match demo's per-halo ease-out timing
    // Approximate ease-out: fast expansion early, slow at end
    const eased = 1 - (1 - lp) * (1 - lp);
    return {
      opacity: interpolate(eased, [0, 0.5, 1], [1, 0.4, 0]),
      transform: [{ scale: interpolate(eased, [0, 0.5, 1], [0, 2, 3]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.haloBase,
        {
          top: centerY - size / 2,
          left: centerX - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: bw,
          borderColor: `${color}80`,
        },
        animStyle,
      ]}
    />
  );
});

/**
 * Floating sparkle particle drifting upward with twinkle.
 * Matches HTML demo startGodParticles canvas: random distribution,
 * slow upward drift, sin-based flicker, life decay.
 */
const GodParticle = React.memo(function GodParticle({
  startXRatio,
  startYRatio,
  driftXRatio,
  driftYRatio,
  sizeRatio,
  baseAlpha,
  twinklePhase,
  particleProgress,
  twinkleCycle,
  color,
  cardWidth,
  cardHeight,
}: {
  startXRatio: number;
  startYRatio: number;
  driftXRatio: number;
  driftYRatio: number;
  sizeRatio: number;
  baseAlpha: number;
  twinklePhase: number;
  particleProgress: SharedValue<number>;
  twinkleCycle: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const startX = startXRatio * cardWidth;
  const startY = startYRatio * cardHeight;
  const totalDriftX = driftXRatio * cardWidth;
  const totalDriftY = driftYRatio * cardHeight;
  const size = Math.max(1, sizeRatio * cardWidth);

  const animStyle = useAnimatedStyle(() => {
    const p = particleProgress.value;
    const life = 1 - p;
    if (life <= 0) {
      return { opacity: 0 };
    }
    const flicker = 0.5 + 0.5 * Math.sin(twinkleCycle.value + twinklePhase);
    const alpha = baseAlpha * life * flicker;
    return {
      opacity: alpha,
      transform: [
        { translateX: startX + totalDriftX * p - size / 2 },
        { translateY: startY + totalDriftY * p - size / 2 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particleBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 ${Math.round(size * 3)}px ${Math.round(size)}px ${color}20`,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Main component ──────────────────────────────────────────────────────

interface GodRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const GodRevealEffect: React.FC<GodRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const progress = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;
  const barThickness = Math.max(2, cardWidth * 0.02);

  useEffect(() => {
    if (!animate) return;

    // Transient effects progress: 0→1 over 2.5s
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow: fast peak then settle to persistent low glow
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 625, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Particle life: 0→1 over ~5.5s, starts after 400ms delay (matching demo setTimeout(draw, 400))
    particleProgress.value = withDelay(
      AE.effectStartDelay + PARTICLE_START_DELAY_MS,
      withTiming(1, { duration: PARTICLE_LIFETIME_MS, easing: Easing.linear }),
    );

    // Twinkle cycle: 0→2π repeating every ~1047ms (demo: 0.1 rad/frame at 60fps)
    twinkleCycle.value = withDelay(
      AE.effectStartDelay + PARTICLE_START_DELAY_MS,
      withRepeat(
        withTiming(Math.PI * 2, { duration: TWINKLE_CYCLE_MS, easing: Easing.linear }),
        -1,
      ),
    );
  }, [animate, progress, glowIntensity, particleProgress, twinkleCycle]);

  // Card glow wrapper — animated boxShadow via opacity
  const cardGlowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  // Cross horizontal bar (matches HTML @keyframes crossH: 1s delay 0.2s ease-out)
  // HTML: 0% scaleX(0) → 25% scaleX(1.3) → 60% scaleX(1.1) → 100% scaleX(1.5)
  // On 2.5s progress, delay 0.2s = p 0.08; 1s duration = 0.4 range
  const crossHStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [0.08, 0.48], [0, 1], Extrapolation.CLAMP);
    // Per-cross ease-out matching HTML: animation: crossH 1s 0.2s ease-out
    const eased = 1 - (1 - lp) * (1 - lp);
    return {
      opacity: interpolate(eased, [0, 0.1, 0.25, 0.6, 1], [0, 1, 1, 0.3, 0], Extrapolation.CLAMP),
      transform: [
        { scaleX: interpolate(eased, [0, 0.25, 0.6, 1], [0, 1.3, 1.1, 1.5], Extrapolation.CLAMP) },
      ],
    };
  });

  // Cross vertical bar (matches HTML @keyframes crossV: 1s delay 0.2s ease-out)
  // HTML: 0% scaleY(0) → 25% scaleY(1.3) → 60% scaleY(1.1) → 100% scaleY(1.5)
  const crossVStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lp = interpolate(p, [0.08, 0.48], [0, 1], Extrapolation.CLAMP);
    const eased = 1 - (1 - lp) * (1 - lp);
    return {
      opacity: interpolate(eased, [0, 0.1, 0.25, 0.6, 1], [0, 1, 1, 0.3, 0], Extrapolation.CLAMP),
      transform: [
        { scaleY: interpolate(eased, [0, 0.25, 0.6, 1], [0, 1.3, 1.1, 1.5], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={[styles.container, { width: cardWidth, height: cardHeight }]} pointerEvents="none">
      {/* Persistent card glow — matches HTML godGlow boxShadow animation */}
      <Animated.View
        style={[
          styles.cardGlow,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
            boxShadow: `0 0 ${Math.round(cardWidth * 0.286)}px ${Math.round(cardWidth * 0.107)}px ${glowColor}, 0 0 ${Math.round(cardWidth * 0.571)}px ${Math.round(cardWidth * 0.214)}px ${primaryColor}`,
          },
          cardGlowStyle,
        ]}
      />

      {/* Cross flash — horizontal (center-bright gradient matching HTML demo) */}
      <Animated.View
        style={[
          styles.crossBar,
          {
            top: centerY - barThickness / 2,
            left: centerX - cardWidth,
            width: cardWidth * 2,
            height: barThickness,
          },
          crossHStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', particleColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Cross flash — vertical (center-bright gradient matching HTML demo) */}
      <Animated.View
        style={[
          styles.crossBar,
          {
            top: centerY - cardHeight * (280 / 195 / 2),
            left: centerX - barThickness / 2,
            width: barThickness,
            height: cardHeight * (280 / 195),
          },
          crossVStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', particleColor, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Light rays (16, matching HTML demo — random width/opacity per ray) */}
      {RAYS.map((ray, i) => (
        <GodRay
          key={i}
          angle={ray.angle}
          rayWidth={Math.max(1, cardWidth * ray.widthRatio)}
          rayOpacity={ray.opacity}
          delayP={ray.delayP}
          progress={progress}
          color={primaryColor}
          centerX={centerX}
          centerY={centerY}
          cardHeight={cardHeight}
        />
      ))}

      {/* Expanding halos (3 layers) */}
      {HALO_CONFIGS.map(({ sizeRatio, startP, durationP, bw }, i) => (
        <GodHalo
          key={i}
          sizeRatio={sizeRatio}
          startP={startP}
          durationP={durationP}
          bw={bw}
          progress={progress}
          color={primaryColor}
          centerX={centerX}
          centerY={centerY}
          cardWidth={cardWidth}
        />
      ))}

      {/* Sparkle particle rain (matches HTML canvas: random distribution + upward drift + twinkle) */}
      {GOD_PARTICLES.map((p) => (
        <GodParticle
          key={p.index}
          startXRatio={p.startXRatio}
          startYRatio={p.startYRatio}
          driftXRatio={p.driftXRatio}
          driftYRatio={p.driftYRatio}
          sizeRatio={p.sizeRatio}
          baseAlpha={p.baseAlpha}
          twinklePhase={p.twinklePhase}
          particleProgress={particleProgress}
          twinkleCycle={twinkleCycle}
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
  crossBar: {
    position: 'absolute',
    overflow: 'hidden',
  },
  rayWrapper: {
    position: 'absolute',
    height: 0,
    overflow: 'visible',
  },
  rayInner: {
    position: 'absolute',
    bottom: 0,
  },
  rayOverflowHidden: {
    overflow: 'hidden',
  },
  haloBase: {
    position: 'absolute',
  },
  particleBase: {
    position: 'absolute',
  },
});

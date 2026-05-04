/**
 * MeteorStrike - 流星坠落揭示动画（Skia + Reanimated 4）
 *
 * 视觉设计：原神祈愿风格深空夜幕 + 闪烁星辰 + 流星划过 + 坠地爆炸。
 * 交互：点击飞过屏幕的流星使其坠落 → 冲击波 + 爆炸粒子 → 角色卡揭示。
 * 流星未命中时循环飞过，auto-timeout 8s 后自动触发坠落。
 *
 * Skia 负责：星空背景 + 流星拖尾 + 发光头部 + 冲击波环 + 爆炸碎片。
 * Reanimated 负责：驱动阶段切换 + 卡片入场。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  LinearGradient as SkiaLinearGradient,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  makeMutable,
  runOnJS,
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
import { colors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#020010', '#0a0025', '#050015'] as const;

const MS = CONFIG.meteorStrike;

const COLORS = {
  meteorCore: '#FFFFFF',
  meteorGlow: 'rgba(255, 240, 200, 0.9)',
  meteorTrail: 'rgba(255, 180, 80, 0.6)',
  meteorTrailFade: 'rgba(255, 100, 30, 0.15)',
  impactOrange: 'rgba(255, 200, 100, 0.9)',
  shockwaveColor: 'rgba(255, 200, 100, 0.7)',
  starColor: 'rgba(200, 210, 255, 0.7)',
} as const;

// ─── Pre-computed static data ──────────────────────────────────────────

interface StarData {
  x: number;
  y: number;
  radius: number;
  brightness: number;
  speed: number;
  phase: number;
}

function createStars(screenW: number, screenH: number): StarData[] {
  return Array.from({ length: MS.starCount }, (_, i) => {
    const r1 = ((i * 73 + 17) % 1000) / 1000;
    const r2 = ((i * 41 + 31) % 1000) / 1000;
    const r3 = ((i * 59 + 7) % 1000) / 1000;
    const r4 = ((i * 83 + 11) % 1000) / 1000;
    const r5 = ((i * 97 + 53) % 1000) / 1000;
    return {
      x: r1 * screenW,
      y: r2 * screenH,
      radius: 0.3 + r3 * 1.5,
      brightness: 0.3 + r4 * 0.7,
      speed: 1 + r5 * 3,
      phase: ((i * 67 + 23) % 628) / 100,
    };
  });
}

/** Impact explosion particles */
const IMPACT_PARTICLES = Array.from({ length: MS.impactParticleCount }, (_, i) => {
  const angle = (i / MS.impactParticleCount) * Math.PI * 2 + ((i * 7 + 3) % 10) * 0.06;
  const speed = 2 + ((i * 31) % 100) / 10;
  const r1 = ((i * 43 + 19) % 100) / 100;
  return {
    id: i,
    angle,
    speed,
    radius: 2 + r1 * 5,
    hue: 20 + ((i * 17) % 30),
    decayRate: 0.008 + r1 * 0.012,
  };
});

/** Shockwave rings */
const SHOCKWAVE_COUNT = 2;

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'impact' | 'revealed';

interface MeteorState {
  x: number;
  y: number;
  active: boolean;
  caught: boolean;
  angle: number;
}

// ─── Sub-components ─────────────────────────────────────────────────────

/** Single impact particle driven by sharedValue progress */
interface ImpactParticleProps {
  particle: (typeof IMPACT_PARTICLES)[number];
  cx: number;
  cy: number;
  progress: SharedValue<number>;
}

const ImpactParticleInner: React.FC<ImpactParticleProps> = ({ particle, cx, cy, progress }) => {
  const endX = cx + Math.cos(particle.angle) * particle.speed * 25;
  const endY = cy + Math.sin(particle.angle) * particle.speed * 25 - 20;

  const px = useDerivedValue(() => cx + (endX - cx) * progress.value);
  const py = useDerivedValue(() => {
    const linearY = cy + (endY - cy) * progress.value;
    return linearY + progress.value * progress.value * 40;
  });
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.1) return p / 0.1;
    return Math.max(0, 1 - (p - 0.1) / 0.9);
  });
  const r = useDerivedValue(() => particle.radius * Math.max(0, 1 - progress.value * 0.6));
  const glowR = useDerivedValue(() => r.value * 2);

  const color = `hsl(${particle.hue}, 90%, 65%)`;
  const glowColor = `hsla(${particle.hue}, 90%, 65%, 0.3)`;

  return (
    <Group opacity={opacity}>
      <Circle cx={px} cy={py} r={r} color={color} />
      <Circle cx={px} cy={py} r={glowR} color={glowColor}>
        <Blur blur={3} />
      </Circle>
    </Group>
  );
};
ImpactParticleInner.displayName = 'ImpactParticle';
const ImpactParticle = React.memo(ImpactParticleInner);

/** Shockwave ring */
interface ShockwaveRingProps {
  cx: number;
  cy: number;
  progress: SharedValue<number>;
  delay: number;
}

const ShockwaveRingInner: React.FC<ShockwaveRingProps> = ({ cx, cy, progress, delay }) => {
  const r = useDerivedValue(() => {
    const p = Math.max(0, progress.value - delay);
    return p * 200;
  });
  const opacity = useDerivedValue(() => {
    const p = Math.max(0, progress.value - delay);
    return Math.max(0, 0.7 - p * 0.8);
  });

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      style="stroke"
      strokeWidth={3}
      color={COLORS.shockwaveColor}
      opacity={opacity}
    />
  );
};
ShockwaveRingInner.displayName = 'ShockwaveRing';
const ShockwaveRing = React.memo(ShockwaveRingInner);

/** Single twinkling star */
interface StarCircleProps {
  star: StarData;
  starCycle: SharedValue<number>;
}

const StarCircle: React.FC<StarCircleProps> = React.memo(({ star, starCycle }) => {
  const twinkle = useDerivedValue(() => {
    const t = starCycle.value;
    return 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
  });
  const opacity = useDerivedValue(() => star.brightness * twinkle.value);

  return (
    <Circle cx={star.x} cy={star.y} r={star.radius} color={COLORS.starColor} opacity={opacity} />
  );
});
StarCircle.displayName = 'StarCircle';

// ─── Main component ─────────────────────────────────────────────────────

export const MeteorStrike: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'meteor-strike',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenW, height: screenH } = useWindowDimensions();
  const stars = useMemo(() => createStars(screenW, screenH), [screenW, screenH]);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenW * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const impactCx = screenW / 2;
  const impactCy = screenH * 0.5;

  const [phase, setPhase] = useState<Phase>('atmosphere');
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: MS.revealHoldDuration,
  });

  // ── Meteor state (JS-side, driven by rAF) ──
  const meteorRef = useRef<MeteorState>({
    x: -80,
    y: screenH * 0.18,
    active: false,
    caught: false,
    angle: 0.35,
  });
  const meteorXSV = useSharedValue(-80);
  const meteorYSV = useSharedValue(screenH * 0.18);
  const meteorOpacity = useSharedValue(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  // ── Trail points for meteor (makeMutable — not hooks, safe in initializer) ──
  const trailSV = useRef(
    Array.from({ length: MS.trailLength }, () => ({
      x: makeMutable(-100),
      y: makeMutable(-100),
      opacity: makeMutable(0),
    })),
  ).current;
  const trailIndexRef = useRef(0);
  const trailFrameCountRef = useRef(0);

  // ── Impact animation values ──
  const impactProgress = useSharedValue(0);
  const shockwaveProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // ── Star twinkle cycle ──
  const starCycle = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerImpact = useCallback(() => {
    const m = meteorRef.current;
    if (m.caught) return;
    m.caught = true;
    m.active = false;

    if (enableHaptics) void triggerHaptic('heavy', true);
    setPhase('impact');

    // Animate meteor to impact point
    meteorXSV.value = withTiming(impactCx, {
      duration: MS.impactAnimDuration,
      easing: Easing.in(Easing.quad),
    });
    meteorYSV.value = withTiming(impactCy, {
      duration: MS.impactAnimDuration,
      easing: Easing.in(Easing.quad),
    });

    // After impact anim: explosion
    setTimeout(() => {
      meteorOpacity.value = 0;

      // Flash
      flashOpacity.value = withSequence(
        withTiming(0.8, { duration: 80 }),
        withTiming(0, { duration: 400 }),
      );

      // Shockwaves expand
      shockwaveProgress.value = withTiming(1, {
        duration: MS.shockwaveDuration,
        easing: Easing.out(Easing.cubic),
      });

      // Particles burst
      impactProgress.value = withTiming(1, {
        duration: MS.explosionDuration,
        easing: Easing.out(Easing.cubic),
      });

      // Fade out canvas
      canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));

      // Card reveal
      cardScale.value = withDelay(
        MS.cardRevealDelay,
        withTiming(
          1,
          {
            duration: MS.cardRevealDuration,
            easing: Easing.out(Easing.back(1.15)),
          },
          (finished) => {
            'worklet';
            if (finished) runOnJS(enterRevealed)();
          },
        ),
      );
      cardOpacity.value = withDelay(
        MS.cardRevealDelay,
        withTiming(1, { duration: MS.cardRevealDuration }),
      );
    }, MS.impactAnimDuration);
  }, [
    enableHaptics,
    impactCx,
    impactCy,
    meteorXSV,
    meteorYSV,
    meteorOpacity,
    flashOpacity,
    shockwaveProgress,
    impactProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    enterRevealed,
  ]);

  // ── Spawn / animate meteor loop ──
  const spawnMeteor = useCallback(() => {
    const m = meteorRef.current;
    m.x = -60;
    m.y = screenH * (0.12 + Math.random() * 0.13);
    m.active = true;
    m.caught = false;
    m.angle = 0.25 + Math.random() * 0.2;
    meteorXSV.value = m.x;
    meteorYSV.value = m.y;
    meteorOpacity.value = withTiming(1, { duration: 200 });
  }, [meteorXSV, meteorYSV, meteorOpacity, screenH]);

  const updateMeteor = useCallback(
    (timestamp: number) => {
      const m = meteorRef.current;
      if (m.caught) return;

      const dt = lastFrameRef.current ? Math.min(timestamp - lastFrameRef.current, 32) : 16;
      lastFrameRef.current = timestamp;

      if (m.active) {
        const speed = MS.meteorSpeed * (dt / 16);
        m.x += speed;
        m.y += speed * Math.tan(m.angle);
        meteorXSV.value = m.x;
        meteorYSV.value = m.y;

        // Update trail every N frames
        trailFrameCountRef.current++;
        if (trailFrameCountRef.current % MS.trailUpdateInterval === 0) {
          const idx = trailIndexRef.current % MS.trailLength;
          trailSV[idx]!.x.value = m.x;
          trailSV[idx]!.y.value = m.y;
          trailSV[idx]!.opacity.value = 1;
          // Fade out
          trailSV[idx]!.opacity.value = withTiming(0, { duration: MS.trailFadeDuration });
          trailIndexRef.current++;
        }

        // Off screen → respawn
        if (m.x > screenW + 100) {
          spawnMeteor();
        }
      }

      rafRef.current = requestAnimationFrame(updateMeteor);
    },
    [meteorXSV, meteorYSV, spawnMeteor, trailSV, screenW],
  );

  // ── Init animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Star twinkle
    starCycle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 6000, easing: Easing.linear }),
      -1,
    );

    // Atmosphere phase → idle
    const atmosphereTimer = setTimeout(() => {
      setPhase('idle');
      spawnMeteor();
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(updateMeteor);
    }, MS.atmosphereDuration);

    return () => {
      clearTimeout(atmosphereTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, starCycle, cardScale, cardOpacity, canvasOpacity, spawnMeteor, updateMeteor]);

  // ── Auto-timeout ──
  const autoTrigger = useCallback(() => {
    if (!meteorRef.current.caught) {
      // Move meteor to a visible spot then trigger
      meteorRef.current.x = screenW * 0.6;
      meteorRef.current.y = screenH * 0.3;
      meteorXSV.value = screenW * 0.6;
      meteorYSV.value = screenH * 0.3;
      triggerImpact();
    }
  }, [meteorXSV, meteorYSV, triggerImpact, screenW, screenH]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoTrigger);

  // ── Tap handler ──
  const handlePress = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (phase !== 'idle') return;
      const m = meteorRef.current;
      if (!m.active || m.caught) return;

      const { locationX, locationY } = evt.nativeEvent;
      const dx = locationX - m.x;
      const dy = locationY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MS.catchRadius) {
        if (enableHaptics) void triggerHaptic('medium', true);
        triggerImpact();
      }
    },
    [phase, enableHaptics, triggerImpact],
  );

  // ── Animated styles ──
  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // ── Meteor glow ──
  const meteorGlowR = useDerivedValue(() => 35);
  const meteorGlowOpacity = useDerivedValue(() => meteorOpacity.value * 0.6);

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Deep-space background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={handlePress}
        testID={`${testIDPrefix}-press-area`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Canvas style={styles.absoluteFillNoEvents}>
            {/* ── Stars ── */}
            {stars.map((star, i) => (
              <StarCircle key={`star-${i}`} star={star} starCycle={starCycle} />
            ))}

            {/* ── Meteor trail glow ── */}
            {trailSV.map((pt, i) => (
              <Group key={`trail-${i}`} opacity={pt.opacity}>
                <Circle cx={pt.x} cy={pt.y} r={4} color={COLORS.meteorTrail}>
                  <Blur blur={3} />
                </Circle>
                <Circle cx={pt.x} cy={pt.y} r={10} color={COLORS.meteorTrailFade}>
                  <Blur blur={6} />
                </Circle>
              </Group>
            ))}

            {/* ── Meteor head ── */}
            <Group opacity={meteorOpacity}>
              {/* Outer glow */}
              <Circle cx={meteorXSV} cy={meteorYSV} r={meteorGlowR} opacity={meteorGlowOpacity}>
                <SkiaLinearGradient
                  start={vec(0, 0)}
                  end={vec(50, 50)}
                  colors={[COLORS.meteorGlow, COLORS.meteorTrailFade]}
                />
                <Blur blur={12} />
              </Circle>
              {/* Core */}
              <Circle cx={meteorXSV} cy={meteorYSV} r={5} color={COLORS.meteorCore} />
              {/* Inner glow */}
              <Circle cx={meteorXSV} cy={meteorYSV} r={12} color={COLORS.meteorGlow}>
                <Blur blur={4} />
              </Circle>
            </Group>

            {/* ── Shockwaves ── */}
            {Array.from({ length: SHOCKWAVE_COUNT }, (_, i) => (
              <ShockwaveRing
                key={`sw-${i}`}
                cx={impactCx}
                cy={impactCy}
                progress={shockwaveProgress}
                delay={i * 0.12}
              />
            ))}

            {/* ── Impact particles ── */}
            {phase === 'impact' &&
              IMPACT_PARTICLES.map((p) => (
                <ImpactParticle
                  key={`ip-${p.id}`}
                  particle={p}
                  cx={impactCx}
                  cy={impactCy}
                  progress={impactProgress}
                />
              ))}
          </Canvas>
        </Animated.View>

        {/* Flash overlay */}
        <Animated.View
          style={[styles.flash, flashStyle, { backgroundColor: COLORS.impactOrange }]}
        />
      </Pressable>

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'atmosphere'
            ? '🌠 星空凝望中…'
            : phase === 'idle'
              ? '🌠 点击划过的流星！'
              : phase === 'impact'
                ? '💥 陨石坠落！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'impact' || phase === 'revealed') && (
        <Animated.View style={[styles.cardWrapper, cardStyle]}>
          <View style={styles.cardInner}>
            <RoleCardContent
              roleId={role.id as RoleId}
              width={cardWidth}
              height={cardHeight}
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />
            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                animate={!reducedMotion}
                onComplete={fireComplete}
              />
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  absoluteFillNoEvents: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});

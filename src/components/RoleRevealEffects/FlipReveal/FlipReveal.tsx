/**
 * FlipReveal - 3D 翻牌揭示动画（Reanimated 4）
 *
 * 特点：悬浮 → 翻转气压波纹 → 边缘发光 → 金粒子爆发 → 弹跳落地。
 * 使用 `useSharedValue` + `withTiming`/`withSequence` 驱动，
 * 阶段切换通过 `runOnJS` 回调，无 `setTimeout`。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCard } from '@/components/RoleRevealEffects/common/RoleCard';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import type { RoleId } from '@/models/roles';
import { borderRadius, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const EFFECT_COLORS = {
  edgeGlow: '#FFD700',
  ripple: 'rgba(255, 215, 0, 0.3)',
  particle: ['#FFD700', '#FFA500', '#FF6347', '#FFFFFF', '#87CEEB'],
};

// ─── Self-animating particle ────────────────────────────────────────────
interface ParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  size: number;
  color: string;
  duration: number;
}

const BurstParticle: React.FC<ParticleConfig> = React.memo(
  ({ targetX, targetY, size, color, duration }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, [duration, progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: progress.value * targetX },
        { translateY: progress.value * targetY },
        { scale: interpolate(progress.value, [0, 0.15, 0.3, 1], [0, 1, 1, 0]) },
      ],
      opacity: interpolate(progress.value, [0, 0.7, 1], [1, 0.5, 0]),
    }));

    return (
      <Animated.View
        style={[
          styles.particle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            shadowColor: EFFECT_COLORS.edgeGlow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
          },
          animStyle,
        ]}
      />
    );
  },
);
BurstParticle.displayName = 'BurstParticle';

// ─── Main component ─────────────────────────────────────────────────────
export const FlipReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'flip-reveal',
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const config = CONFIG.flip;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'entry' | 'levitate' | 'flipping' | 'landing' | 'revealed'>(
    'entry',
  );
  const [particles, setParticles] = useState<ParticleConfig[]>([]);
  const onCompleteCalledRef = useRef(false);

  // ── Shared values ──
  const entryScale = useSharedValue(0.6);
  const entryOpacity = useSharedValue(0);
  const levitateY = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front
  const edgeGlowOpacity = useSharedValue(0);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const bounceScale = useSharedValue(1);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Particle burst ──
  const createParticles = useCallback(() => {
    const configs: ParticleConfig[] = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 30,
        color: EFFECT_COLORS.particle[i % EFFECT_COLORS.particle.length],
        size: 8 + (i % 4) * 4,
        duration: 600 + Math.random() * 400,
      });
    }
    setParticles(configs);
  }, []);

  // ── Phase transitions (declared bottom-up to avoid forward references) ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
  }, []);

  const startLanding = useCallback(() => {
    setPhase('landing');
    if (enableHaptics) triggerHaptic('heavy', true);
    createParticles();

    // Drop back down
    levitateY.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.cubic),
    });

    // Bounce sequence → revealed (deterministic timing, no spring oscillation)
    bounceY.value = withSequence(
      withTiming(-15, { duration: 100, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      }),
    );
    bounceScale.value = withSequence(
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );
  }, [levitateY, bounceY, bounceScale, createParticles, enableHaptics, enterRevealed]);

  const startFlip = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) triggerHaptic('medium', true);

    // Edge glow pulse during flip
    edgeGlowOpacity.value = withSequence(
      withTiming(1, { duration: config.flipDuration * 0.3 }),
      withDelay(config.flipDuration * 0.3, withTiming(0, { duration: config.flipDuration * 0.4 })),
    );

    // Air ripple
    rippleOpacity.value = 0.6;
    rippleScale.value = withTiming(2, {
      duration: config.flipDuration,
      easing: Easing.out(Easing.cubic),
    });
    rippleOpacity.value = withTiming(0, { duration: config.flipDuration });

    // Main 180° flip → landing
    flipProgress.value = withTiming(
      1,
      { duration: config.flipDuration, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(startLanding)();
      },
    );
  }, [
    flipProgress,
    edgeGlowOpacity,
    rippleScale,
    rippleOpacity,
    config.flipDuration,
    enableHaptics,
    startLanding,
  ]);

  const startLevitation = useCallback(() => {
    setPhase('levitate');
    levitateY.value = withTiming(
      -30,
      { duration: 250, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(startFlip)();
      },
    );
  }, [levitateY, startFlip]);

  // Glow border flash done → hold → onComplete
  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    setTimeout(() => onComplete(), config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      entryOpacity.value = 1;
      entryScale.value = 1;
      setPhase('revealed');
      const timer = setTimeout(() => onComplete(), config.revealHoldDuration);
      return () => clearTimeout(timer);
    }

    // Entry: fade-in + spring scale → levitate after 300 ms delay
    entryOpacity.value = withTiming(1, { duration: 300 });
    entryScale.value = withTiming(
      1,
      { duration: 250, easing: Easing.out(Easing.back(1.5)) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(startLevitation)();
        }
      },
    );
  }, [
    reducedMotion,
    flipProgress,
    entryOpacity,
    entryScale,
    startLevitation,
    onComplete,
    config.revealHoldDuration,
  ]);

  // ── Animated styles ──
  const cardContainerStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [
      { translateY: levitateY.value + bounceY.value },
      { scale: entryScale.value * bounceScale.value },
    ],
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateY: `${interpolate(flipProgress.value, [0, 0.5, 1], [0, 90, 180])}deg`,
      },
    ],
    opacity: flipProgress.value < 0.5 ? 1 : 0,
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateY: `${interpolate(flipProgress.value, [0, 0.5, 1], [180, 90, 0])}deg`,
      },
    ],
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const edgeGlowStyle = useAnimatedStyle(() => ({
    opacity: edgeGlowOpacity.value,
  }));

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Air ripple */}
      <Animated.View
        style={[
          styles.ripple,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: borderRadius.large,
            borderColor: EFFECT_COLORS.ripple,
          },
          rippleStyle,
        ]}
      />

      {/* Celebration particles */}
      <View style={styles.particleContainer}>
        {particles.map((p) => (
          <BurstParticle key={p.id} {...p} />
        ))}
      </View>

      {/* Main card container */}
      <Animated.View
        style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, cardContainerStyle]}
      >
        {/* Card back (question mark) */}
        <Animated.View
          style={[styles.cardFace, { width: cardWidth, height: cardHeight }, frontFaceStyle]}
        >
          <RoleCard role={role} showBack={true} width={cardWidth} height={cardHeight} />
        </Animated.View>

        {/* Card front (role revealed) */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            { width: cardWidth, height: cardHeight },
            backFaceStyle,
          ]}
        >
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />

          {/* Edge glow during flip */}
          <Animated.View
            style={[
              styles.edgeGlow,
              {
                borderColor: EFFECT_COLORS.edgeGlow,
                shadowColor: EFFECT_COLORS.edgeGlow,
              },
              edgeGlowStyle,
            ]}
          />
        </Animated.View>

        {/* Glow border on reveal */}
        {phase === 'revealed' && (
          <GlowBorder
            width={cardWidth + common.glowPadding}
            height={cardHeight + common.glowPadding}
            color={theme.primaryColor}
            glowColor={theme.glowColor}
            borderWidth={common.glowBorderWidth}
            borderRadius={borderRadius.medium + 4}
            animate={!reducedMotion}
            flashCount={common.glowFlashCount}
            flashDuration={common.glowFlashDuration}
            onComplete={handleGlowComplete}
            style={{ position: 'absolute', top: -4, left: -4 }}
          />
        )}
      </Animated.View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    overflow: 'visible',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    backfaceVisibility: 'hidden',
    overflow: 'visible',
  },
  cardBack: {
    // positioned absolutely via cardFace
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: borderRadius.medium,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 3,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
});

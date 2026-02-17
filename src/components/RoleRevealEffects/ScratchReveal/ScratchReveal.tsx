/**
 * ScratchReveal - 刮刮卡风格揭示动画（Reanimated 4 + Gesture Handler 2）
 *
 * 特点：金属银刮层、刮痕纹理、金属碎片粒子、触觉反馈、进度条。
 * 使用 `Gesture.Pan()` 替代 PanResponder，`useSharedValue` 驱动所有动画。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, spacing, typography, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const SCRATCH_COLORS = {
  metalBase: '#C0C0C0',
  metalLight: '#E8E8E8',
  metalDark: '#909090',
  shavingColors: ['#D4D4D4', '#B8B8B8', '#A0A0A0', '#888888'],
};

interface ScratchPoint {
  x: number;
  y: number;
  id: string;
}

// ─── Self-animating metal shaving particle ──────────────────────────────
interface ShavingConfig {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: string;
  size: number;
}

const MetalShaving: React.FC<ShavingConfig> = React.memo(
  ({ startX, startY, targetX, targetY, color, size }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    }, [progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1], [startX, targetX]),
        },
        {
          translateY: interpolate(progress.value, [0, 1], [startY, targetY]),
        },
        { scale: interpolate(progress.value, [0, 1], [1, 0.3]) },
        {
          rotate: `${interpolate(progress.value, [0, 1], [0, Math.random() * 360 - 180])}deg`,
        },
      ],
      opacity: interpolate(progress.value, [0, 0.7, 1], [1, 0.6, 0]),
    }));

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shaving,
          {
            width: size,
            height: size * 0.6,
            backgroundColor: color,
          },
          animStyle,
        ]}
      />
    );
  },
);
MetalShaving.displayName = 'MetalShaving';

// ─── Main component ─────────────────────────────────────────────────────
export const ScratchReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'scratch-reveal',
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const config = CONFIG.scratch;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [scratchPoints, setScratchPoints] = useState<ScratchPoint[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [shavings, setShavings] = useState<ShavingConfig[]>([]);
  const [showGlow, setShowGlow] = useState(false);

  // ── Shared values ──
  const revealAnim = useSharedValue(0);
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const sheenPosition = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const scratchedAreaRef = useRef(0);
  const lastHapticTime = useRef(0);
  const shavingIdRef = useRef(0);
  const onCompleteCalledRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const totalArea = cardWidth * cardHeight;
  const brushRadius = config.brushRadius;

  // ── Metallic sheen animation ──
  useEffect(() => {
    if (reducedMotion || isRevealed) return;

    sheenPosition.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(sheenPosition);
    };
  }, [sheenPosition, reducedMotion, isRevealed]);

  // ── Progress calculation ──
  const calculateProgress = useCallback(() => {
    const brushArea = Math.PI * brushRadius * brushRadius;
    const estimatedArea = scratchedAreaRef.current * brushArea * 0.15;
    return Math.min(1, estimatedArea / totalArea);
  }, [brushRadius, totalArea]);

  // ── Create metal shaving ──
  const createShaving = useCallback((x: number, y: number) => {
    const id = shavingIdRef.current++;
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 40;

    setShavings((prev) => [
      ...prev.slice(-30),
      {
        id,
        startX: x,
        startY: y,
        targetX: x + Math.cos(angle) * distance,
        targetY: y + Math.sin(angle) * distance + 20,
        color: SCRATCH_COLORS.shavingColors[id % SCRATCH_COLORS.shavingColors.length],
        size: 4 + Math.random() * 6,
      },
    ]);
  }, []);

  // ── Reveal trigger ──
  const triggerReveal = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);

    if (enableHaptics) triggerHaptic('success', true);

    // Light burst
    burstOpacity.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(0, { duration: 300 }),
    );
    burstScale.value = withTiming(2, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    // Reveal animation
    revealAnim.value = withTiming(1, { duration: config.revealDuration }, (finished) => {
      'worklet';
      if (finished) runOnJS(setShowGlow)(true);
    });
  }, [isRevealed, revealAnim, burstScale, burstOpacity, config.revealDuration, enableHaptics]);

  // ── Glow complete ──
  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    holdTimerRef.current = setTimeout(() => onComplete(), config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // ── Add scratch point ──
  const addScratchPoint = useCallback(
    (x: number, y: number) => {
      if (isRevealed) return;

      setScratchPoints((prev) => [...prev, { x, y, id: `scratch-${Date.now()}-${Math.random()}` }]);
      scratchedAreaRef.current += 1;

      const progress = calculateProgress();
      setScratchProgress(progress);
      progressWidth.value = withTiming(progress, { duration: 100 });

      // Create shaving particle occasionally
      if (Math.random() > 0.7) {
        createShaving(x, y);
      }

      // Throttled haptic
      if (enableHaptics) {
        const now = Date.now();
        if (now - lastHapticTime.current > 50) {
          triggerHaptic('light', true);
          lastHapticTime.current = now;
        }
      }

      if (progress >= config.autoRevealThreshold) {
        triggerReveal();
      }
    },
    [
      isRevealed,
      calculateProgress,
      config.autoRevealThreshold,
      triggerReveal,
      createShaving,
      enableHaptics,
      progressWidth,
    ],
  );

  // ── Gesture Handler (replaces PanResponder) ──
  // Refs to avoid stale closures in gesture callbacks
  const isRevealedRef = useRef(isRevealed);
  const addScratchPointRef = useRef(addScratchPoint);

  useEffect(() => {
    isRevealedRef.current = isRevealed;
  }, [isRevealed]);

  useEffect(() => {
    addScratchPointRef.current = addScratchPoint;
  }, [addScratchPoint]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reducedMotion)
        .onBegin((e) => {
          'worklet';
          if (isRevealedRef.current) return;
          runOnJS(addScratchPointRef.current)(e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          if (isRevealedRef.current) return;
          runOnJS(addScratchPointRef.current)(e.x, e.y);
        }),
    [reducedMotion],
  );

  // ── Reduced motion: tap to reveal ──
  const handleTapReveal = useCallback(() => {
    if (reducedMotion && !isRevealed) {
      triggerReveal();
    }
  }, [reducedMotion, isRevealed, triggerReveal]);

  // ── Animated styles ──
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sheenPosition.value, [0, 1], [-cardWidth, cardWidth]),
      },
    ],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as `${number}%`,
  }));

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Light burst */}
      <Animated.View
        style={[
          styles.lightBurst,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: cardWidth,
            backgroundColor: theme.glowColor,
          },
          burstStyle,
        ]}
      />

      {/* Main scratch card */}
      <View
        style={[
          styles.cardWrapper,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
          },
        ]}
      >
        {/* Role card underneath */}
        <View style={styles.roleCardLayer}>
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />
        </View>

        {/* Scratch overlay */}
        {!isRevealed && (
          <GestureDetector gesture={panGesture}>
            <View
              style={[
                styles.scratchLayer,
                {
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius: borderRadius.medium,
                },
              ]}
            >
              {/* Metallic base */}
              <LinearGradient
                colors={[
                  SCRATCH_COLORS.metalLight,
                  SCRATCH_COLORS.metalBase,
                  SCRATCH_COLORS.metalDark,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Animated sheen */}
              <Animated.View style={[styles.sheen, sheenStyle]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Scratch holes */}
              {scratchPoints.map((point) => (
                <View
                  key={point.id}
                  style={[
                    styles.scratchHole,
                    {
                      left: point.x - brushRadius,
                      top: point.y - brushRadius,
                      width: brushRadius * 2,
                      height: brushRadius * 2,
                      borderRadius: brushRadius,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.scratchHoleContent,
                      {
                        width: cardWidth,
                        height: cardHeight,
                        left: -(point.x - brushRadius),
                        top: -(point.y - brushRadius),
                      },
                    ]}
                  >
                    <RoleCardContent
                      roleId={role.id as RoleId}
                      width={cardWidth}
                      height={cardHeight}
                    />
                  </View>
                </View>
              ))}

              {/* Scratch texture */}
              <View style={styles.textureOverlay}>
                {scratchPoints.slice(-50).map((point, index) => (
                  <View
                    key={`texture-${point.id}`}
                    style={[
                      styles.scratchMark,
                      {
                        left: point.x - 2,
                        top: point.y - 2,
                        opacity: 0.3 + (index / 50) * 0.4,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Hint text */}
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>刮开查看角色</Text>
                <Text style={styles.hintIcon}>👆</Text>
              </View>
            </View>
          </GestureDetector>
        )}

        {/* Metal shavings */}
        {shavings.map((s) => (
          <MetalShaving key={s.id} {...s} />
        ))}

        {/* Glow border on reveal */}
        {showGlow && (
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
            style={styles.glowBorder}
          />
        )}
      </View>

      {/* Progress bar */}
      {!isRevealed && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primaryColor },
                progressBarStyle,
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.round(scratchProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Reduced motion: tap button */}
      {reducedMotion && !isRevealed && (
        <TouchableOpacity
          testID={`${testIDPrefix}-tap-reveal`}
          style={[styles.tapButton, { backgroundColor: theme.primaryColor }]}
          onPress={handleTapReveal}
        >
          <Text style={styles.tapButtonText}>点击揭示角色</Text>
        </TouchableOpacity>
      )}
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
  cardWrapper: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  roleCardLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  scratchLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  scratchHole: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 2,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 1,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  scratchMark: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
  },
  hintContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  hintText: {
    fontSize: typography.title,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hintIcon: {
    fontSize: 32,
    marginTop: spacing.small,
  },
  shaving: {
    position: 'absolute',
    borderRadius: 1,
  },
  lightBurst: {
    position: 'absolute',
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  scratchHoleContent: {
    position: 'absolute',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.large,
  },
  progressTrack: {
    width: 150,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginLeft: spacing.small,
    fontSize: typography.caption,
    fontWeight: '600',
    width: 40,
  },
  tapButton: {
    marginTop: spacing.large,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
  },
  tapButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
});

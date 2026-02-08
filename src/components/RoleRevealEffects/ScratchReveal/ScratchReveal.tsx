/**
 * ScratchReveal - 刮刮卡风格揭示动画
 *
 * 特点：金属银刮层、刮痕纹理、金属碎片粒子、触觉反馈、进度条。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  Easing,
} from 'react-native';
// No SVG imports needed - using native View clipping
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import { canUseNativeDriver } from '@/components/RoleRevealEffects/utils/platform';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import type { RoleId } from '@/models/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scratch effect colors
const SCRATCH_COLORS = {
  metalBase: '#C0C0C0',
  metalLight: '#E8E8E8',
  metalDark: '#909090',
  metalSheen: '#FFFFFF',
  shavingColors: ['#D4D4D4', '#B8B8B8', '#A0A0A0', '#888888'],
};

interface ScratchPoint {
  x: number;
  y: number;
  id: string;
}

interface MetalShaving {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  size: number;
}

export const ScratchReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'scratch-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.scratch;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [scratchPoints, setScratchPoints] = useState<ScratchPoint[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [shavings, setShavings] = useState<MetalShaving[]>([]);
  const [showGlow, setShowGlow] = useState(false);

  const revealAnim = useMemo(() => new Animated.Value(0), []);
  const burstScale = useMemo(() => new Animated.Value(0), []);
  const burstOpacity = useMemo(() => new Animated.Value(0), []);
  const sheenPosition = useMemo(() => new Animated.Value(0), []);
  const progressWidth = useMemo(() => new Animated.Value(0), []);

  const scratchedAreaRef = useRef(0);
  const lastHapticTime = useRef(0);
  const shavingIdRef = useRef(0);

  // Use same calculation as RoleCardSimple: Math.min(SCREEN_WIDTH * 0.75, 280) and ratio 1.4
  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.4;
  const totalArea = cardWidth * cardHeight;
  const brushRadius = config.brushRadius;

  // Animate metallic sheen
  useEffect(() => {
    if (reducedMotion || isRevealed) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sheenPosition, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(sheenPosition, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [sheenPosition, reducedMotion, isRevealed]);

  // Calculate scratch progress based on scratched area
  const calculateProgress = useCallback(() => {
    const brushArea = Math.PI * brushRadius * brushRadius;
    // Overlap factor: points are close together when scratching,
    // so actual revealed area is much smaller than brush count × brush area
    // Using 0.15 to account for ~85% overlap between consecutive scratch points
    const estimatedArea = scratchedAreaRef.current * brushArea * 0.15;
    return Math.min(1, estimatedArea / totalArea);
  }, [brushRadius, totalArea]);

  // Create metal shaving particle
  const createShaving = useCallback((x: number, y: number) => {
    const id = shavingIdRef.current++;
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    const targetX = x + Math.cos(angle) * distance;
    const targetY = y + Math.sin(angle) * distance + 20; // Gravity

    const shaving: MetalShaving = {
      id,
      x: new Animated.Value(x),
      y: new Animated.Value(y),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
      color: SCRATCH_COLORS.shavingColors[id % SCRATCH_COLORS.shavingColors.length],
      size: 4 + Math.random() * 6,
    };

    setShavings((prev) => [...prev.slice(-30), shaving]); // Keep max 30 shavings

    // Animate shaving
    Animated.parallel([
      Animated.timing(shaving.x, {
        toValue: targetX,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shaving.y, {
        toValue: targetY,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shaving.rotation, {
        toValue: Math.random() * 4 - 2,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shaving.opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shaving.scale, {
        toValue: 0.3,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();
  }, []);

  // Handle reveal animation
  const triggerReveal = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);

    if (enableHaptics) {
      triggerHaptic('success', true);
    }

    // Light burst effect
    Animated.parallel([
      Animated.timing(burstScale, {
        toValue: 2,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.sequence([
        Animated.timing(burstOpacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(burstOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    ]).start();

    // Reveal animation
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: config.revealDuration,
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      setShowGlow(true);
    });
  }, [isRevealed, revealAnim, burstScale, burstOpacity, config.revealDuration, enableHaptics]);

  // Handle glow complete
  const handleGlowComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Add scratch point
  const addScratchPoint = useCallback(
    (x: number, y: number) => {
      if (isRevealed) return;

      const newPoint: ScratchPoint = {
        x,
        y,
        id: `scratch-${Date.now()}-${Math.random()}`,
      };

      setScratchPoints((prev) => [...prev, newPoint]);
      scratchedAreaRef.current += 1;

      const progress = calculateProgress();
      setScratchProgress(progress);

      // Update progress bar
      Animated.timing(progressWidth, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();

      // Create metal shaving
      if (Math.random() > 0.7) {
        createShaving(x, y);
      }

      // Haptic feedback (throttled)
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

  // Refs for PanResponder
  const isRevealedRef = useRef(isRevealed);
  const reducedMotionRef = useRef(reducedMotion);
  const addScratchPointRef = useRef(addScratchPoint);

  useEffect(() => {
    isRevealedRef.current = isRevealed;
  }, [isRevealed]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    addScratchPointRef.current = addScratchPoint;
  }, [addScratchPoint]);

  // PanResponder reads refs inside callbacks (not during render) — safe pattern
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !reducedMotionRef.current && !isRevealedRef.current,
        onMoveShouldSetPanResponder: () => !reducedMotionRef.current && !isRevealedRef.current,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          addScratchPointRef.current(locationX, locationY);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          addScratchPointRef.current(locationX, locationY);
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  // Reduced motion: tap to reveal
  const handleTapReveal = useCallback(() => {
    if (reducedMotion && !isRevealed) {
      triggerReveal();
    }
  }, [reducedMotion, isRevealed, triggerReveal]);

  // Sheen animation interpolation
  const sheenTranslateX = sheenPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth, cardWidth],
  });

  // Progress bar width interpolation
  const progressBarWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Light burst effect */}
      <Animated.View
        style={[
          styles.lightBurst,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: cardWidth,
            backgroundColor: theme.glowColor,
            transform: [{ scale: burstScale }],
            opacity: burstOpacity,
          },
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

        {/* Scratch overlay layer */}
        {!isRevealed && (
          <View
            {...panResponder.panHandlers}
            style={[
              styles.scratchLayer,
              {
                width: cardWidth,
                height: cardHeight,
                borderRadius: borderRadius.medium,
              },
            ]}
          >
            {/* Metallic base layer */}
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
            <Animated.View
              style={[
                styles.sheen,
                {
                  transform: [{ translateX: sheenTranslateX }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* Scratch holes - each hole shows the role card beneath */}
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
                {/* Clipped view of the role card at this position */}
                <View
                  style={{
                    width: cardWidth,
                    height: cardHeight,
                    position: 'absolute',
                    left: -(point.x - brushRadius),
                    top: -(point.y - brushRadius),
                  }}
                >
                  <RoleCardContent
                    roleId={role.id as RoleId}
                    width={cardWidth}
                    height={cardHeight}
                  />
                </View>
              </View>
            ))}

            {/* Scratch texture overlay */}
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
        )}

        {/* Metal shavings */}
        {shavings.map((shaving) => (
          <Animated.View
            key={shaving.id}
            pointerEvents="none"
            style={[
              styles.shaving,
              {
                width: shaving.size,
                height: shaving.size * 0.6,
                backgroundColor: shaving.color,
                transform: [
                  { translateX: shaving.x },
                  { translateY: shaving.y },
                  { scale: shaving.scale },
                  {
                    rotate: shaving.rotation.interpolate({
                      inputRange: [-2, 2],
                      outputRange: ['-180deg', '180deg'],
                    }),
                  },
                ],
                opacity: shaving.opacity,
              },
            ]}
          />
        ))}

        {/* Glow border on reveal */}
        {showGlow && (
          <GlowBorder
            width={cardWidth + 8}
            height={cardHeight + 8}
            color={theme.primaryColor}
            glowColor={theme.glowColor}
            borderWidth={3}
            borderRadius={borderRadius.medium + 4}
            animate={!reducedMotion}
            flashCount={3}
            flashDuration={200}
            onComplete={handleGlowComplete}
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
            }}
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
                {
                  width: progressBarWidth,
                  backgroundColor: theme.primaryColor,
                },
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

/**
 * ScratchReveal - 刮刮卡风格揭示动画（CSS Transitions + Gesture Handler 2）
 *
 * 特点：金属银刮层 + 菱形底纹 + 序列号 + 规则文字，刮痕纹理，金属碎片粒子，
 * 进度里程碑闪光，触觉反馈，"PRIZE"印章，彩纸礼花绽放。
 * 使用 `Gesture.Pan()` 驱动刮卡交互，CSS transitions/animations 驱动所有动画。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { borderRadius, colors, crossPlatformTextShadow, spacing, typography } from '@/theme';

import ScratchConfettiCanvas from './ScratchConfettiCanvas';

// Register keyframe for sheen animation
registerKeyframes(
  'scratchSheen',
  'from{transform:translateX(-300px)}to{transform:translateX(300px)}',
);

// ─── Visual constants ──────────────────────────────────────────────────
const SCRATCH_COLORS = {
  metalBase: '#C0C0C0',
  metalLight: '#E8E8E8',
  metalDark: '#909090',
  shavingColors: ['#D4D4D4', '#B8B8B8', '#A0A0A0', '#888888'],
  milestoneFlash: '#ffffff',
};

// Random serial number (stable per mount)
function generateSerial(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) s += '-';
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

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
    const [fired, setFired] = useState(false);
    const [rotation] = useState(() => Math.random() * 360 - 180);

    useEffect(() => {
      requestAnimationFrame(() => setFired(true));
    }, []);

    const style = {
      transform: [
        { translateX: fired ? targetX : startX },
        { translateY: fired ? targetY : startY },
        { scale: fired ? 0.3 : 1 },
        { rotate: fired ? `${rotation}deg` : '0deg' },
      ],
      opacity: fired ? 0 : 1,
      transitionProperty: 'opacity, transform',
      transitionDuration: '400ms',
      transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
    } as never;

    return (
      <View
        style={[
          styles.shaving,
          {
            width: size * 1.8,
            height: size * 0.35,
            borderRadius: size * 0.15,
            backgroundColor: color,
          },
          style,
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const config = CONFIG.scratch;
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const [scratchPoints, setScratchPoints] = useState<ScratchPoint[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [shavings, setShavings] = useState<ShavingConfig[]>([]);
  const [showGlow, setShowGlow] = useState(false);

  // ── Shared values ──
  const [burstScale, setBurstScale] = useState(0);
  const [burstOpacity, setBurstOpacity] = useState(0);
  const [progressWidthPct, setProgressWidthPct] = useState(0);
  const [milestoneFlashOpacity, setMilestoneFlashOpacity] = useState(0);
  const [prizeStampOpacity, setPrizeStampOpacity] = useState(0);
  const [prizeStampScale, setPrizeStampScale] = useState(0.5);
  const [sheenActive, setSheenActive] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // Stable serial number
  const [serialNumber] = useState(() => generateSerial());
  const milestone50Triggered = useRef(false);
  const milestone75Triggered = useRef(false);

  const scratchedAreaRef = useRef(0);
  const lastHapticTime = useRef(0);
  const shavingIdRef = useRef(0);

  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const totalArea = cardWidth * cardHeight;
  const brushRadius = config.brushRadius;

  // ── Metallic sheen animation ──
  useEffect(() => {
    if (reducedMotion || isRevealed) {
      setSheenActive(false);
      return;
    }
    setSheenActive(true);

    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion, isRevealed]);

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
        color: SCRATCH_COLORS.shavingColors[id % SCRATCH_COLORS.shavingColors.length]!,
        size: 4 + Math.random() * 6,
      },
    ]);
  }, []);

  // ── Reveal trigger ──
  const triggerReveal = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);

    if (enableHaptics) void triggerHaptic('success', true);

    // Light burst
    setBurstOpacity(0.8);
    setBurstScale(2);
    schedule(() => setBurstOpacity(0), 100);

    // Show glow after reveal duration
    schedule(() => setShowGlow(true), config.revealDuration);

    // Prize stamp pop-in
    schedule(() => {
      setPrizeStampOpacity(1);
      setPrizeStampScale(1.2);
      schedule(() => setPrizeStampScale(1), 200);
    }, 200);
  }, [isRevealed, config.revealDuration, enableHaptics, schedule]);

  // ── Auto-timeout (8s auto-reveal if user doesn't scratch) ──
  const autoTimeoutWarning = useAutoTimeout(!isRevealed && !reducedMotion, triggerReveal);

  // ── Add scratch point ──
  const addScratchPoint = useCallback(
    (x: number, y: number) => {
      if (isRevealed) return;

      setScratchPoints((prev) => [...prev, { x, y, id: `scratch-${Date.now()}-${Math.random()}` }]);
      scratchedAreaRef.current += 1;

      const progress = calculateProgress();
      setScratchProgress(progress);
      setProgressWidthPct(progress);

      // Create shaving particle occasionally
      if (Math.random() > 0.7) {
        createShaving(x, y);
      }

      // Throttled haptic
      if (enableHaptics) {
        const now = Date.now();
        if (now - lastHapticTime.current > 50) {
          void triggerHaptic('light', true);
          lastHapticTime.current = now;
        }
      }

      if (progress >= config.autoRevealThreshold) {
        triggerReveal();
      }

      // Milestone flash at 50% and 75%
      if (progress >= 0.5 && !milestone50Triggered.current) {
        milestone50Triggered.current = true;
        setMilestoneFlashOpacity(0.5);
        schedule(() => setMilestoneFlashOpacity(0), 80);
        if (enableHaptics) void triggerHaptic('medium', true);
      } else if (progress >= 0.75 && !milestone75Triggered.current) {
        milestone75Triggered.current = true;
        setMilestoneFlashOpacity(0.7);
        schedule(() => setMilestoneFlashOpacity(0), 80);
        if (enableHaptics) void triggerHaptic('medium', true);
      }
    },
    [
      isRevealed,
      calculateProgress,
      config.autoRevealThreshold,
      triggerReveal,
      createShaving,
      enableHaptics,
      schedule,
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
          if (isRevealedRef.current) return;
          addScratchPointRef.current(e.x, e.y);
        })
        .onUpdate((e) => {
          if (isRevealedRef.current) return;
          addScratchPointRef.current(e.x, e.y);
        }),
    [reducedMotion],
  );

  // ── Reduced motion: tap to reveal ──
  const handleTapReveal = useCallback(() => {
    if (reducedMotion && !isRevealed) {
      triggerReveal();
    }
  }, [reducedMotion, isRevealed, triggerReveal]);

  // ── Computed styles ──
  const sheenStyle = {
    animationName: sheenActive ? 'scratchSheen' : 'none',
    animationDuration: '2000ms',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
  } as never;

  const burstStyle = {
    transform: [{ scale: burstScale }],
    opacity: burstOpacity,
    transitionProperty: 'opacity, transform',
    transitionDuration: '300ms',
    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  } as never;

  const progressBarStyle = {
    width: `${progressWidthPct * 100}%`,
    transitionProperty: 'width',
    transitionDuration: '100ms',
  } as never;

  const milestoneStyle = {
    opacity: milestoneFlashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: milestoneFlashOpacity > 0 ? '80ms' : '300ms',
  } as never;

  const prizeStampStyle = {
    opacity: prizeStampOpacity,
    transform: [{ scale: prizeStampScale }, { rotate: '-15deg' }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '200ms',
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Confetti burst — Canvas 2D DOM component */}
      {isRevealed && !reducedMotion && (
        <ScratchConfettiCanvas
          dom={{
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: screenHeight,
              pointerEvents: 'none',
            },
          }}
          width={screenWidth}
          height={screenHeight}
          trigger
        />
      )}

      {/* Milestone flash overlay */}
      <View style={[styles.milestoneFlash, milestoneStyle]} />

      {/* Light burst */}
      <View
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
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
            revealMode
            revealGradient={theme.revealGradient}
            animateEntrance={isRevealed}
          />
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

              {/* Diamond pattern texture on metal */}
              <View style={styles.diamondPattern}>
                {Array.from({ length: 5 }, (_, row) => (
                  <View key={`dp-row-${row}`} style={styles.diamondRow}>
                    {Array.from({ length: 7 }, (_, col) => (
                      <Text key={`dp-${row}-${col}`} style={styles.diamondChar}>
                        ◇
                      </Text>
                    ))}
                  </View>
                ))}
              </View>

              {/* Animated sheen */}
              <View style={[styles.sheen, sheenStyle]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>

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
                      revealMode
                      revealGradient={theme.revealGradient}
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
                <Text style={styles.hintText}>🧤 滑动手指刮开银层</Text>
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
        <RevealBurst trigger={showGlow} color={theme.glowColor} />

        {/* Prize stamp — pops in after reveal */}
        {isRevealed && (
          <View style={[styles.prizeStamp, prizeStampStyle]}>
            <Text style={[styles.prizeStampText, { color: theme.primaryColor }]}>PRIZE</Text>
          </View>
        )}

        {showGlow && (
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

      {/* Progress bar */}
      {!isRevealed && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
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

      {/* Serial number */}
      <View style={styles.serialContainer}>
        <Text style={[styles.serialText, { color: colors.textSecondary }]}>NO. {serialNumber}</Text>
      </View>

      {/* Rules text */}
      <View style={styles.rulesContainer}>
        <Text style={[styles.rulesText, { color: colors.textSecondary }]}>刮开涂层，揭晓命运</Text>
      </View>

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

      {/* Auto-timeout warning */}
      <HintWithWarning hintText={null} showWarning={autoTimeoutWarning} />
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
  milestoneFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SCRATCH_COLORS.milestoneFlash,
    pointerEvents: 'none',
  },
  cardWrapper: {
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0,0,0,0.3)',
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
    color: 'rgba(0,0,0,0.5)',
    ...crossPlatformTextShadow('rgba(255,255,255,0.5)', 1, 1, 2),
  },
  hintIcon: {
    fontSize: 32,
    marginTop: spacing.small,
  },
  shaving: {
    position: 'absolute',
    borderRadius: 1,
    borderWidth: 0.5,
    borderColor: SCRATCH_COLORS.metalLight,
    pointerEvents: 'none',
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
  diamondPattern: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.08,
    pointerEvents: 'none',
  },
  diamondRow: {
    flexDirection: 'row',
    gap: 12,
  },
  diamondChar: {
    fontSize: 16,
    color: '#000000',
  },
  prizeStamp: {
    position: 'absolute',
    top: 15,
    right: 10,
    pointerEvents: 'none',
  },
  prizeStampText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    borderWidth: 2,
    borderColor: 'currentColor',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    opacity: 0.7,
  },
  serialContainer: {
    position: 'absolute',
    bottom: 28,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  serialText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    opacity: 0.5,
    fontFamily: 'monospace',
  },
  rulesContainer: {
    position: 'absolute',
    bottom: 12,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  rulesText: {
    fontSize: 10,
    opacity: 0.4,
  },
});

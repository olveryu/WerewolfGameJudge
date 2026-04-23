/**
 * FortuneWheel - 命运转盘揭示动画（SVG + RN Text + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：宝石色彩扇形 + 金色外圈转盘，每格显示角色名（RN Text），顶部固定指针。
 * 交互：Pan 拖拽/flick 旋转转盘，减速后停在玩家真实角色。
 * 停止后：闪光 → 转盘淡出 → 卡牌放大揭示。
 *
 * 角色名使用 RN Text overlay（Skia matchFont 在 web 不可用），通过
 * Animated.View rotation 同步跟随 Skia 转盘旋转。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle as SvgCircle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line as SvgLine,
  Path as SvgPath,
  RadialGradient as SvgRadialGradient,
  Stop,
} from 'react-native-svg';

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
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { colors, crossPlatformTextShadow } from '@/theme';

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedG = Animated.createAnimatedComponent(G);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0a1e', '#12122a', '#0a0a1e'] as const;

/** Vivid jewel-tone segment fills (alternating for visual depth) */
const SEGMENT_FILLS = [
  '#4B3F9E', // deep purple
  '#2E8B7A', // emerald
  '#C0392B', // ruby
  '#2471A3', // sapphire
  '#7D3C98', // amethyst
  '#D4AC0D', // topaz
  '#1E8449', // jade
  '#BA4A00', // amber
  '#5B4FBE', // light purple
  '#3CB371', // light emerald
  '#E74C3C', // light ruby
  '#3498DB', // light sapphire
] as const;

const GOLD = '#FFD700';
const GOLD_DARK = '#B8860B';
const SEGMENT_DIVIDER = 'rgba(255, 215, 0, 0.5)';
const CENTER_FILL = '#1a1a2e';
const POINTER_FILL = '#E74C3C';
const POINTER_STROKE_COLOR = '#FFD700';
const HINT_ALIGNED_COLOR = '#4ECDC4';

// Gem bulb colors for rim decorations
const GEM_COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff6633'];

// Pre-computed starfield
const STARS = Array.from({ length: 25 }, (_, i) => ({
  x: (((i * 73 + 17) % 100) / 100) * SCREEN_W,
  y: (((i * 41 + 31) % 100) / 100) * SCREEN_H,
  r: 0.5 + (((i * 59 + 7) % 100) / 100) * 1,
}));

const FW = CONFIG.fortuneWheel;

// ─── Gem bulb with animated pulse (replaces Picture API batch) ─────────
interface GemBulbProps {
  dotX: number;
  dotY: number;
  color: string;
  phaseOffset: number;
  gemPulse: SharedValue<number>;
}

const GemBulb: React.FC<GemBulbProps> = React.memo(
  ({ dotX, dotY, color, phaseOffset, gemPulse }) => {
    const animatedProps = useAnimatedProps(() => ({
      opacity: 0.5 + Math.sin(gemPulse.value + phaseOffset) * 0.3,
    }));

    return (
      <AnimatedSvgCircle
        cx={dotX}
        cy={dotY}
        r={DOT_R + 2}
        fill={color}
        filter="url(#gem-blur)"
        animatedProps={animatedProps}
      />
    );
  },
);
GemBulb.displayName = 'GemBulb';

// ─── Pointer tick glow (animated opacity) ─────────────────────
interface PointerTickGlowProps {
  cx: number;
  cy: number;
  pointerTickGlow: SharedValue<number>;
}

const PointerTickGlow: React.FC<PointerTickGlowProps> = React.memo(
  ({ cx, cy, pointerTickGlow }) => {
    const animatedProps = useAnimatedProps(() => ({
      opacity: pointerTickGlow.value * 0.6,
    }));

    return (
      <AnimatedSvgCircle
        cx={cx}
        cy={cy}
        r={8}
        fill="url(#pointer-glow-grad)"
        filter="url(#pointer-blur)"
        animatedProps={animatedProps}
      />
    );
  },
);
PointerTickGlow.displayName = 'PointerTickGlow';

// ─── Layout ratios ──────────────────────────────────────────────────────
const RIM_RATIO = 0.04;
const LABEL_DIST = 0.62;
const LABEL_SIZE = 80;
const DOT_R = 3;

// ─── Helpers ────────────────────────────────────────────────────────────
function buildSectorPath(
  sectorCx: number,
  sectorCy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = sectorCx + r * Math.cos(startAngle);
  const y1 = sectorCy + r * Math.sin(startAngle);
  const x2 = sectorCx + r * Math.cos(endAngle);
  const y2 = sectorCy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${sectorCx} ${sectorCy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function buildPointerPath(pointerCx: number, topY: number, size: number): string {
  const tipY = topY + size;
  const halfW = size * 0.55;
  return `M ${pointerCx} ${tipY} L ${pointerCx - halfW} ${topY} L ${pointerCx + halfW} ${topY} Z`;
}

/** Ensure label text is never upside-down when the wheel rotates. */
function readableLabelDeg(midAngle: number): number {
  const deg = ((midAngle + Math.PI / 2) * 180) / Math.PI;
  const n = ((deg % 360) + 360) % 360;
  return n > 90 && n < 270 ? deg + 180 : deg;
}

// ─── Props ──────────────────────────────────────────────────────────────
interface FortuneWheelProps extends RoleRevealEffectProps {
  allRoles?: RoleData[];
}

// ─── Main component ─────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'spinning' | 'stopped' | 'revealed';

export const FortuneWheel: React.FC<FortuneWheelProps> = ({
  role,
  allRoles,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'fortune-wheel',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const wheelR = Math.min(screenWidth, screenHeight) * 0.38;
  const innerR = wheelR * (1 - RIM_RATIO);
  const centerR = wheelR * 0.18;

  // Prepare segments from allRoles (deduplicated, min 6)
  const segments = useMemo(() => {
    const source = allRoles ?? [role];
    const unique = [...new Set(source.map((r) => r.id))];
    const roles = unique.map((id) => source.find((r) => r.id === id)!);
    if (roles.length < 6) {
      const padded = [...roles];
      while (padded.length < 6) {
        padded.push(roles[padded.length % roles.length]);
      }
      return padded;
    }
    return roles;
  }, [allRoles, role]);

  const segmentCount = segments.length;
  const segmentAngle = (Math.PI * 2) / segmentCount;

  const targetIndex = useMemo(() => {
    const idx = segments.findIndex((s) => s.id === role.id);
    return idx >= 0 ? idx : 0;
  }, [segments, role.id]);

  // Precompute segment geometry
  const segmentData = useMemo(() => {
    return segments.map((seg, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      const midAngle = (startAngle + endAngle) / 2;
      const dist = wheelR * LABEL_DIST;
      const displayLabel = seg.name.length > 4 ? seg.name.slice(0, 4) : seg.name;

      return {
        path: buildSectorPath(cx, cy, innerR, startAngle, endAngle),
        color: SEGMENT_FILLS[i % SEGMENT_FILLS.length],
        displayLabel,
        labelX: cx + dist * Math.cos(midAngle),
        labelY: cy + dist * Math.sin(midAngle),
        labelRotDeg: readableLabelDeg(midAngle),
        edgeX: cx + innerR * Math.cos(startAngle),
        edgeY: cy + innerR * Math.sin(startAngle),
        dotX: cx + (wheelR - DOT_R * 2.5) * Math.cos(startAngle),
        dotY: cy + (wheelR - DOT_R * 2.5) * Math.sin(startAngle),
      };
    });
  }, [segments, segmentAngle, wheelR, innerR, cx, cy]);

  const pointerPath = useMemo(() => buildPointerPath(cx, cy - wheelR - 20, 26), [cx, cy, wheelR]);

  const [phase, setPhase] = useState<Phase>('appear');
  const { fireComplete } = useRevealLifecycle({ onComplete });

  const wheelOpacity = useSharedValue(0);
  const wheelScaleVal = useSharedValue(0);
  const rotation = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScaleVal = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const dragStartAngle = useSharedValue(0);
  const rotationOnDragStart = useSharedValue(0);

  // Scene shared values
  const gemPulse = useSharedValue(0);
  const pointerTickGlow = useSharedValue(0);
  const victoryArchOpacity = useSharedValue(0);
  const victoryArchScale = useSharedValue(0.8);

  // ── SVG animated props for wheel rotation ──
  const wheelGroupProps = useAnimatedProps(() => ({
    rotation: (rotation.value * 180) / Math.PI,
  }));

  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerCardReveal = useCallback(() => {
    if (enableHaptics) void triggerHaptic('heavy', true);

    flashOpacity.value = withSequence(
      withTiming(0.6, { duration: 100 }),
      withTiming(0, { duration: 400 }),
    );
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));
    cardScaleVal.value = withDelay(
      300,
      withTiming(
        1,
        { duration: FW.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(300, withTiming(1, { duration: FW.cardRevealDuration }));

    // Victory arch
    victoryArchOpacity.value = withDelay(400, withTiming(0.8, { duration: 500 }));
    victoryArchScale.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.1)) }),
    );
  }, [
    canvasOpacity,
    cardScaleVal,
    cardOpacity,
    flashOpacity,
    victoryArchOpacity,
    victoryArchScale,
    enableHaptics,
    enterRevealed,
  ]);

  const computeTargetRotation = useCallback(
    (currentRotation: number) => {
      const targetMidOffset = targetIndex * segmentAngle + segmentAngle / 2;
      const extraSpins = 4 + Math.floor(Math.random() * 3);
      const baseTarget = Math.PI * 2 * extraSpins - targetMidOffset;
      const normalizedCurrent = currentRotation % (Math.PI * 2);
      const finalRotation = currentRotation - normalizedCurrent + baseTarget;
      const jitter = (Math.random() - 0.5) * segmentAngle * 0.3;
      return finalRotation + jitter;
    },
    [targetIndex, segmentAngle],
  );

  // Appear animation
  useEffect(() => {
    if (reducedMotion) {
      cardScaleVal.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }
    wheelOpacity.value = withTiming(1, { duration: FW.appearDuration / 2 });
    // Gem bulbs pulse
    gemPulse.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }),
      -1,
    );
    wheelScaleVal.value = withTiming(
      1,
      { duration: FW.appearDuration, easing: Easing.out(Easing.back(1.15)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );
  }, [
    reducedMotion,
    wheelOpacity,
    wheelScaleVal,
    gemPulse,
    cardScaleVal,
    cardOpacity,
    canvasOpacity,
  ]);

  // Deceleration spin to target
  const startDeceleratingToTarget = useCallback(() => {
    setPhase('spinning');
    const finalRotation = computeTargetRotation(rotation.value);
    const duration = 2500 + Math.random() * 1000;

    // Pointer tick glow pulses during spin
    pointerTickGlow.value = withRepeat(
      withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 80 })),
      Math.floor(duration / 160),
    );

    rotation.value = withTiming(
      finalRotation,
      { duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('stopped');
      },
    );

    if (enableHaptics) {
      const tickCount = Math.floor(duration / 150);
      for (let t = 0; t < tickCount; t++) {
        setTimeout(
          () => {
            if (t < tickCount * 0.7 || t % 2 === 0) {
              void triggerHaptic('light', true);
            }
          },
          (t / tickCount) * duration,
        );
      }
    }
  }, [computeTargetRotation, rotation, pointerTickGlow, enableHaptics]);

  // Trigger card reveal when wheel stops
  useEffect(() => {
    if (phase !== 'stopped') return;
    const timer = setTimeout(() => triggerCardReveal(), 400);
    return () => clearTimeout(timer);
  }, [phase, triggerCardReveal]);

  // Auto-spin timeout (warning + 8s auto-spin)
  const autoSpin = useCallback(() => {
    rotation.value = rotation.value + Math.PI * 0.5;
    startDeceleratingToTarget();
  }, [rotation, startDeceleratingToTarget]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoSpin);

  // Pan gesture (flick to spin)
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          const dx = e.x - cx;
          const dy = e.y - cy;
          dragStartAngle.value = Math.atan2(dy, dx);
          rotationOnDragStart.value = rotation.value;
        })
        .onUpdate((e) => {
          'worklet';
          const dx = e.x - cx;
          const dy = e.y - cy;
          const currentAngle = Math.atan2(dy, dx);
          const delta = currentAngle - dragStartAngle.value;
          rotation.value = rotationOnDragStart.value + delta;
        })
        .onEnd((e) => {
          'worklet';
          const dx = e.x - cx;
          const dy = e.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const tangentialV = (-e.velocityY * dx + e.velocityX * dy) / Math.max(dist, 1);
          const angularV = tangentialV / Math.max(dist, 1);
          if (Math.abs(angularV) > 0.5) {
            rotation.value = rotation.value + angularV * 0.3;
            runOnJS(startDeceleratingToTarget)();
          }
        })
        .enabled(phase === 'idle'),
    [cx, cy, rotation, dragStartAngle, rotationOnDragStart, phase, startDeceleratingToTarget],
  );

  // ─── Animated styles ──────────────────────────────────────────────────

  const wheelContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wheelScaleVal.value }],
    opacity: wheelOpacity.value,
  }));

  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  /** RN Text labels rotate in sync with the Skia wheel */
  const labelRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}rad` }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScaleVal.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyleAnim = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const victoryArchStyle = useAnimatedStyle(() => ({
    opacity: victoryArchOpacity.value,
    transform: [{ scale: victoryArchScale.value }],
  }));

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Starfield background — declarative SVG (replaces module-level Picture) */}
      {!reducedMotion && (
        <Svg style={styles.fullScreen}>
          <Defs>
            <Filter id="star-blur">
              <FeGaussianBlur stdDeviation={4} />
            </Filter>
          </Defs>
          {/* eslint-disable-next-line react-native/no-inline-styles -- SVG CSS property, not RN style */}
          <G style={{ mixBlendMode: 'screen' }} filter="url(#star-blur)">
            {STARS.map((star, i) => (
              <G key={`star-${i}`}>
                <SvgCircle cx={star.x} cy={star.y} r={star.r * 4} fill="#aaaaff" opacity={0.3} />
                <SvgCircle cx={star.x} cy={star.y} r={star.r} fill="#ccccff" opacity={0.8} />
              </G>
            ))}
          </G>
        </Svg>
      )}

      {/* Pedestal base */}
      <View style={styles.pedestal}>
        <View style={styles.pedestalTop} />
        <View style={styles.pedestalBody} />
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, wheelContainerStyle]}>
            {/* ── SVG Canvas: sectors + gold rim + center + pointer ── */}
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <Filter id="gem-blur">
                  <FeGaussianBlur stdDeviation={3} />
                </Filter>
                <Filter id="highlight-blur">
                  <FeGaussianBlur stdDeviation={1} />
                </Filter>
                <Filter id="pointer-blur">
                  <FeGaussianBlur stdDeviation={4} />
                </Filter>
                <SvgRadialGradient
                  id="center-gem-grad"
                  cx={String(cx - 2)}
                  cy={String(cy - 2)}
                  r={String(centerR * 0.35)}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#ff6666" />
                  <Stop offset="0.5" stopColor="#cc0033" />
                  <Stop offset="1" stopColor="#660019" />
                </SvgRadialGradient>
                <SvgRadialGradient
                  id="pointer-glow-grad"
                  cx={String(cx)}
                  cy={String(cy - wheelR - 20 + 26)}
                  r="8"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#ff6666" stopOpacity={0.5} />
                  <Stop offset="1" stopColor="#ff6600" stopOpacity={0} />
                </SvgRadialGradient>
              </Defs>

              {/* Rotating group: sectors + rim decorations */}
              <AnimatedG originX={cx} originY={cy} animatedProps={wheelGroupProps}>
                {/* Gold outer rim (background circle) */}
                <SvgCircle cx={cx} cy={cy} r={wheelR} fill={GOLD_DARK} />
                <SvgCircle cx={cx} cy={cy} r={wheelR} stroke={GOLD} fill="none" strokeWidth={3} />

                {/* Sector fills */}
                {segmentData.map((seg, i) => (
                  <SvgPath key={`s-${i}`} d={seg.path} fill={seg.color} />
                ))}

                {/* Gold divider lines + rim dots at segment boundaries */}
                {segmentData.map((seg, i) => (
                  <G key={`d-${i}`}>
                    <SvgLine
                      x1={cx}
                      y1={cy}
                      x2={seg.edgeX}
                      y2={seg.edgeY}
                      stroke={SEGMENT_DIVIDER}
                      strokeWidth={1.5}
                    />
                    <SvgCircle cx={seg.dotX} cy={seg.dotY} r={DOT_R} fill={GOLD} />
                  </G>
                ))}

                {/* Inner edge circle (crisp boundary between sectors and gold rim) */}
                <SvgCircle
                  cx={cx}
                  cy={cy}
                  r={innerR}
                  stroke={GOLD_DARK}
                  fill="none"
                  strokeWidth={1.5}
                />

                {/* Gem bulbs at rim — individual animated circles with blur */}
                {segmentData.map((seg, i) => (
                  <GemBulb
                    key={`gem-${i}`}
                    dotX={seg.dotX}
                    dotY={seg.dotY}
                    color={GEM_COLORS[i % GEM_COLORS.length]}
                    phaseOffset={(i * Math.PI) / 3}
                    gemPulse={gemPulse}
                  />
                ))}
              </AnimatedG>

              {/* Static elements (don't rotate) */}
              {/* Center hub */}
              <SvgCircle cx={cx} cy={cy} r={centerR} fill={CENTER_FILL} />
              <SvgCircle cx={cx} cy={cy} r={centerR} stroke={GOLD} fill="none" strokeWidth={3} />
              <SvgCircle
                cx={cx}
                cy={cy}
                r={centerR * 0.7}
                stroke={GOLD_DARK}
                fill="none"
                strokeWidth={1}
              />
              {/* Center gem */}
              <SvgCircle cx={cx} cy={cy} r={centerR * 0.35} fill="url(#center-gem-grad)" />
              <SvgCircle
                cx={cx - 3}
                cy={cy - 3}
                r={3}
                fill="#ffffff"
                opacity={0.4}
                filter="url(#highlight-blur)"
              />

              {/* Pointer triangle */}
              <SvgPath d={pointerPath} fill={POINTER_FILL} />
              <SvgPath d={pointerPath} stroke={POINTER_STROKE_COLOR} fill="none" strokeWidth={2} />
              {/* Pointer tick glow — flashes during spin */}
              <PointerTickGlow
                cx={cx}
                cy={cy - wheelR - 20 + 26}
                pointerTickGlow={pointerTickGlow}
              />
            </Svg>

            {/* ── RN Text labels (rotate with wheel via Animated.View) ── */}
            <Animated.View style={[styles.absoluteFillNoEvents, labelRotateStyle]}>
              {segmentData.map((seg, i) => (
                <View
                  key={`lbl-${i}`}
                  style={[
                    styles.labelContainer,
                    {
                      left: seg.labelX - LABEL_SIZE / 2,
                      top: seg.labelY - LABEL_SIZE / 2,
                      width: LABEL_SIZE,
                      height: LABEL_SIZE,
                      transform: [{ rotate: `${seg.labelRotDeg}deg` }],
                    },
                  ]}
                >
                  <Text style={styles.segmentLabel}>{seg.displayLabel}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Center "?" text (static, above canvas) */}
            <View style={[styles.centerTextWrap, { left: cx - 20, top: cy - 16 }]}>
              <Text style={styles.centerText}>?</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Flash overlay */}
      <Animated.View style={[styles.flash, flashStyleAnim, { backgroundColor: theme.glowColor }]} />

      {/* Phase hints */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '🎰 转盘就绪'
            : phase === 'idle'
              ? '🎰 拨动转盘，揭晓身份'
              : phase === 'spinning'
                ? '🎰 命运转动中'
                : phase === 'stopped'
                  ? '✨ 命运已定！'
                  : null
        }
        showWarning={autoTimeoutWarning}
        hintTextStyle={phase === 'stopped' ? { color: HINT_ALIGNED_COLOR } : undefined}
      />

      {/* Card reveal */}
      {(phase === 'stopped' || phase === 'revealed') && (
        <>
          {/* Victory arch — golden glow ring behind card */}
          <Animated.View style={[styles.victoryArch, victoryArchStyle]}>
            <Svg style={styles.victoryArchCanvas}>
              <Defs>
                <SvgRadialGradient
                  id="victory-glow"
                  cx={String(cardWidth / 2 + 20)}
                  cy={String(cardHeight / 2 + 20)}
                  r={String(cardWidth * 0.7)}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={GOLD} stopOpacity={0} />
                  <Stop offset="0.5" stopColor={GOLD} stopOpacity={0.19} />
                  <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
                </SvgRadialGradient>
                <Filter id="ray-blur">
                  <FeGaussianBlur stdDeviation={3} />
                </Filter>
              </Defs>
              <SvgCircle
                cx={cardWidth / 2 + 20}
                cy={cardHeight / 2 + 20}
                r={cardWidth * 0.7}
                fill="url(#victory-glow)"
              />
              {/* Ray lines */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (Math.PI * 2 * i) / 8;
                const ir = cardWidth * 0.45;
                const or = cardWidth * 0.65;
                return (
                  <SvgLine
                    key={`ray-${i}`}
                    x1={cardWidth / 2 + 20 + Math.cos(angle) * ir}
                    y1={cardHeight / 2 + 20 + Math.sin(angle) * ir}
                    x2={cardWidth / 2 + 20 + Math.cos(angle) * or}
                    y2={cardHeight / 2 + 20 + Math.sin(angle) * or}
                    stroke={GOLD}
                    strokeWidth={2}
                    filter="url(#ray-blur)"
                  />
                );
              })}
            </Svg>
          </Animated.View>

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
        </>
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
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    pointerEvents: 'none',
  },
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  pedestal: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pedestalTop: {
    width: 120,
    height: 8,
    backgroundColor: '#333355',
    borderRadius: 4,
  },
  pedestalBody: {
    width: 80,
    height: 30,
    backgroundColor: '#222244',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -1,
  },
  victoryArch: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  victoryArchCanvas: {
    width: 400,
    height: 400,
  },

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
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.8)', 0, 1, 3),
  },
  centerTextWrap: {
    position: 'absolute',
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  centerText: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '900',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.5)', 0, 1, 2),
  },
});

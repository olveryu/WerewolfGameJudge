/**
 * FateGears - 命运齿轮揭示动画（Skia + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：中央单个可旋转齿轮 + 齿轮上橙色三角箭头 + 外圈黄色三角目标标记 +
 * 两个半透明装饰齿轮（左上 + 右下缓慢自转）。
 * 交互：Pan 拖拽旋转齿轮，箭头对齐目标后锁定。
 * 对齐后：吸附 + 青色脉冲环 → 齿轮淡出 → 卡牌放大。
 * 未对齐松手：红橙色脉冲环反馈。
 *
 * 视觉参照：docs/interactive-reveal-demo.html #fateGears。
 * Skia 负责：齿轮 Path + 三角箭头 + 装饰齿轮 + 脉冲环。
 * Reanimated 负责：驱动旋转角度 + 阶段切换。
 * Gesture Handler 负责：Pan 手势 → 旋转角度映射。
 * 不 import service，不含业务逻辑。
 */
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  cancelAnimation,
  Easing,
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
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
/** Background gradient: deep indigo to complement purple gears + cyan alignment glow */
const BG_GRADIENT = ['#08081a', '#0c0c24', '#08081a'] as const;

const COLORS = {
  /** Gear body fill */
  gearFill: 'rgba(108, 99, 255, 0.3)',
  gearStroke: 'rgba(108, 99, 255, 0.5)',
  /** Aligned gear colors */
  gearAlignedFill: 'rgba(78, 205, 196, 0.3)',
  gearAlignedStroke: 'rgba(78, 205, 196, 0.7)',
  /** Center hub */
  hubFill: '#2A2A3E',
  hubStroke: 'rgba(108, 99, 255, 0.5)',
  hubAlignedStroke: 'rgba(78, 205, 196, 0.7)',
  /** Arrow on gear */
  arrowNormal: '#FF8844',
  arrowAligned: '#4ECDC4',
  /** Target marker */
  targetNormal: 'rgba(255, 220, 80, 0.2)',
  targetAligned: 'rgba(78, 205, 196, 0.4)',
  /** Background decorative gears */
  bgGearFill: 'rgba(40, 40, 60, 0.5)',
  bgGearStroke: 'rgba(80, 80, 110, 0.3)',
  /** Snap feedback ring */
  snapAligned: 'rgba(78, 205, 196, 0.5)',
  snapMissed: 'rgba(255, 100, 50, 0.3)',
  /** Hint text */
  hintText: 'rgba(255, 255, 255, 0.85)',
  hintAligned: '#4ECDC4',
} as const;

const FG = CONFIG.fateGears;

// ─── Gear path builder ──────────────────────────────────────────────────

/**
 * Build an SVG path for a gear with protruding teeth (matching demo drawGear).
 * Teeth: valley at innerR → ramp up to outerR → across tooth → ramp down.
 */
function buildGearPath(
  gearCx: number,
  gearCy: number,
  innerRadius: number,
  outerRadius: number,
  teethCount: number,
): string {
  const parts: string[] = [];

  for (let i = 0; i < teethCount; i++) {
    const a0 = (i / teethCount) * Math.PI * 2;
    const a1 = ((i + 0.3) / teethCount) * Math.PI * 2;
    const a2 = ((i + 0.5) / teethCount) * Math.PI * 2;
    const a3 = ((i + 0.8) / teethCount) * Math.PI * 2;

    const p0x = gearCx + Math.cos(a0) * innerRadius;
    const p0y = gearCy + Math.sin(a0) * innerRadius;
    const p1x = gearCx + Math.cos(a1) * innerRadius;
    const p1y = gearCy + Math.sin(a1) * innerRadius;
    const p1ox = gearCx + Math.cos(a1) * outerRadius;
    const p1oy = gearCy + Math.sin(a1) * outerRadius;
    const p2ox = gearCx + Math.cos(a2) * outerRadius;
    const p2oy = gearCy + Math.sin(a2) * outerRadius;
    const p3x = gearCx + Math.cos(a3) * innerRadius;
    const p3y = gearCy + Math.sin(a3) * innerRadius;

    if (i === 0) {
      parts.push(`M ${p0x.toFixed(1)} ${p0y.toFixed(1)}`);
    }
    parts.push(`L ${p1x.toFixed(1)} ${p1y.toFixed(1)}`);
    parts.push(`L ${p1ox.toFixed(1)} ${p1oy.toFixed(1)}`);
    parts.push(`L ${p2ox.toFixed(1)} ${p2oy.toFixed(1)}`);
    parts.push(`L ${p3x.toFixed(1)} ${p3y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Build a triangle (arrow) path pointing outward from center at given angle. */
function buildArrowPath(
  arrowCx: number,
  arrowCy: number,
  innerDist: number,
  outerDist: number,
  halfWidth: number,
  angle: number,
): string {
  const tipX = arrowCx + Math.cos(angle) * outerDist;
  const tipY = arrowCy + Math.sin(angle) * outerDist;
  const perpAngle = angle + Math.PI / 2;
  const b1x = arrowCx + Math.cos(angle) * innerDist + Math.cos(perpAngle) * halfWidth;
  const b1y = arrowCy + Math.sin(angle) * innerDist + Math.sin(perpAngle) * halfWidth;
  const b2x = arrowCx + Math.cos(angle) * innerDist - Math.cos(perpAngle) * halfWidth;
  const b2y = arrowCy + Math.sin(angle) * innerDist - Math.sin(perpAngle) * halfWidth;
  return `M ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${b1x.toFixed(1)} ${b1y.toFixed(1)} L ${b2x.toFixed(1)} ${b2y.toFixed(1)} Z`;
}

// ─── Normalize angle to [-π, π) ────────────────────────────────────────
function normalizeAngle(angle: number): number {
  'worklet';
  let a = angle % (Math.PI * 2);
  if (a >= Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Arrow marker sits at angle 0 (3 o'clock) in gear-local coords.
const MARKER_ANGLE = 0;

// ─── Rotated gear group ─────────────────────────────────────────────────
interface RotatedGearGroupProps {
  gearPath: string;
  gcx: number;
  gcy: number;
  rotation: SharedValue<number>;
  fillColor: string;
  strokeColor: string;
  hubRadius: number;
  hubFill: string;
  hubStroke: string;
}

const RotatedGearGroup: React.FC<RotatedGearGroupProps> = ({
  gearPath,
  gcx,
  gcy,
  rotation,
  fillColor,
  strokeColor,
  hubRadius,
  hubFill,
  hubStroke,
}) => {
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);
  return (
    <Group transform={transform} origin={{ x: gcx, y: gcy }}>
      <Path path={gearPath} color={fillColor} />
      <Path path={gearPath} color={strokeColor} style="stroke" strokeWidth={1.5} />
      <Circle cx={gcx} cy={gcy} r={hubRadius} color={hubFill} />
      <Circle cx={gcx} cy={gcy} r={hubRadius} color={hubStroke} style="stroke" strokeWidth={2} />
    </Group>
  );
};

// ─── Rotating arrow on the gear ─────────────────────────────────────────
interface GearArrowProps {
  arrowCx: number;
  arrowCy: number;
  innerDist: number;
  outerDist: number;
  halfWidth: number;
  rotation: SharedValue<number>;
  color: string;
}

const GearArrow: React.FC<GearArrowProps> = ({
  arrowCx,
  arrowCy,
  innerDist,
  outerDist,
  halfWidth,
  rotation,
  color,
}) => {
  const arrowPath = useMemo(
    () => buildArrowPath(arrowCx, arrowCy, innerDist, outerDist, halfWidth, MARKER_ANGLE),
    [arrowCx, arrowCy, innerDist, outerDist, halfWidth],
  );
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);
  return (
    <Group transform={transform} origin={{ x: arrowCx, y: arrowCy }}>
      <Path path={arrowPath} color={color} />
    </Group>
  );
};

// ─── Static decorative gear (auto-rotates) ──────────────────────────────
interface DecorGearProps {
  gearPath: string;
  dgcx: number;
  dgcy: number;
  rotation: SharedValue<number>;
}

const DecorGear: React.FC<DecorGearProps> = ({ gearPath, dgcx, dgcy, rotation }) => {
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);
  return (
    <Group transform={transform} origin={{ x: dgcx, y: dgcy }}>
      <Path path={gearPath} color={COLORS.bgGearFill} />
      <Path path={gearPath} color={COLORS.bgGearStroke} style="stroke" strokeWidth={1.5} />
    </Group>
  );
};

// ─── Main component ─────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'dragging' | 'aligned' | 'revealed';

export const FateGears: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'fate-gears',
}) => {
  const appColors = useColors();
  const alignmentThemes = useMemo(() => createAlignmentThemes(appColors), [appColors]);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const outerR = screenWidth * FG.outerGearRadiusRatio;
  const innerR = outerR * 0.82; // Valley radius (demo: 65/80 ≈ 0.81)
  const hubR = outerR * 0.25; // Center hub radius (demo: 20/80 = 0.25)

  // Decorative gear positions (matching demo layout)
  const bg1x = cx - outerR * 1.1;
  const bg1y = cy - outerR * 1.0;
  const bg1outerR = outerR * 0.44;
  const bg1innerR = bg1outerR * 0.8;
  const bg2x = cx + outerR * 1.25;
  const bg2y = cy + outerR * 0.75;
  const bg2outerR = outerR * 0.31;
  const bg2innerR = bg2outerR * 0.8;

  // Random target angle (set once per mount, matching demo range)
  const [targetAngle] = useState(() => Math.PI * 0.6 + Math.random() * Math.PI * 0.8);

  const [phase, setPhase] = useState<Phase>('appear');
  const [autoTimeoutWarning, setAutoTimeoutWarning] = useState(false);
  const [snapFeedback, setSnapFeedback] = useState<{ aligned: boolean } | null>(null);
  const onCompleteCalledRef = useRef(false);

  // ── Gear paths (static) ──
  const mainGearPath = useMemo(
    () => buildGearPath(cx, cy, innerR, outerR, FG.outerTeethCount),
    [cx, cy, innerR, outerR],
  );
  const bgGear1Path = useMemo(
    () => buildGearPath(bg1x, bg1y, bg1innerR, bg1outerR, 10),
    [bg1x, bg1y, bg1innerR, bg1outerR],
  );
  const bgGear2Path = useMemo(
    () => buildGearPath(bg2x, bg2y, bg2innerR, bg2outerR, 8),
    [bg2x, bg2y, bg2innerR, bg2outerR],
  );

  // Target marker (fixed arrow pointing inward toward center)
  const targetArrowPath = useMemo(() => {
    const base = outerR * 1.06;
    const tip = outerR * 1.25;
    return buildArrowPath(cx, cy, base, tip, outerR * 0.1, targetAngle);
  }, [cx, cy, outerR, targetAngle]);

  // ── Shared values ──
  const gearsOpacity = useSharedValue(0);
  const gearsScale = useSharedValue(0);
  const gearRotation = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const snapRingProgress = useSharedValue(0);
  const snapRingOpacity = useSharedValue(0);

  // Background gear rotations
  const bgRotation1 = useSharedValue(0);
  const bgRotation2 = useSharedValue(0);

  const idleAnimRunning = useRef(true);
  const dragStartAngle = useSharedValue(0);
  const gearRotationOnDragStart = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete();
  }, [onComplete]);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    gearsOpacity.value = withTiming(1, { duration: FG.gearsAppearDuration / 2 });
    gearsScale.value = withTiming(
      1,
      { duration: FG.gearsAppearDuration, easing: Easing.out(Easing.back(1.15)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );

    // Idle auto-rotation for main gear
    gearRotation.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: ((Math.PI * 2) / FG.idleRotationSpeed) * 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    // Background gear auto-rotation (demo: t/8000 and -t*1.2/8000)
    bgRotation1.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );
    bgRotation2.value = withRepeat(
      withTiming(-Math.PI * 2, { duration: 6667, easing: Easing.linear }),
      -1,
      false,
    );
  }, [
    reducedMotion,
    gearsOpacity,
    gearsScale,
    gearRotation,
    bgRotation1,
    bgRotation2,
    cardScale,
    cardOpacity,
    canvasOpacity,
  ]);

  // ── Trigger card reveal (after alignment) ──
  const triggerReveal = useCallback(() => {
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));
    cardScale.value = withDelay(
      300,
      withTiming(
        1,
        { duration: FG.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(300, withTiming(1, { duration: FG.cardRevealDuration }));
  }, [canvasOpacity, cardScale, cardOpacity, enterRevealed]);

  // ── Snap feedback ring animation ──
  const animateSnapRing = useCallback(
    (aligned: boolean) => {
      setSnapFeedback({ aligned });
      snapRingProgress.value = 0;
      snapRingOpacity.value = aligned ? 0.5 : 0.3;
      snapRingProgress.value = withTiming(1, { duration: 300 });
      snapRingOpacity.value = withDelay(100, withTiming(0, { duration: 200 }));
    },
    [snapRingProgress, snapRingOpacity],
  );

  // ── Check alignment ──
  const checkAlignment = useCallback(() => {
    if (phase !== 'dragging') return;

    const arrowWorldAngle = normalizeAngle(gearRotation.value + MARKER_ANGLE);
    const diff = Math.abs(normalizeAngle(arrowWorldAngle - targetAngle));

    if (diff < FG.alignTolerance) {
      setPhase('aligned');
      if (enableHaptics) triggerHaptic('heavy', true);
      animateSnapRing(true);

      // Snap to exact alignment
      const snapped = targetAngle - MARKER_ANGLE;
      const current = gearRotation.value;
      const fullRotations = Math.round(current / (Math.PI * 2));
      gearRotation.value = withTiming(fullRotations * Math.PI * 2 + snapped, {
        duration: FG.snapDuration,
        easing: Easing.out(Easing.quad),
      });

      flashOpacity.value = withSequence(
        withTiming(0.5, { duration: 100 }),
        withTiming(0, { duration: 300 }),
      );

      setTimeout(() => triggerReveal(), FG.snapDuration + 100);
    } else {
      // Not aligned — show miss feedback
      animateSnapRing(false);
    }
  }, [
    phase,
    gearRotation,
    targetAngle,
    enableHaptics,
    animateSnapRing,
    flashOpacity,
    triggerReveal,
  ]);

  // ── Auto-align timeout ──
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'dragging') return;
    const warningTimer = setTimeout(
      () => setAutoTimeoutWarning(true),
      CONFIG.common.autoTimeout - CONFIG.common.autoTimeoutWarningLeadTime,
    );
    const timer = setTimeout(() => {
      if (phase === 'idle' || phase === 'dragging') {
        setPhase('aligned');
        if (enableHaptics) triggerHaptic('heavy', true);
        animateSnapRing(true);

        const snapped = targetAngle - MARKER_ANGLE;
        const current = gearRotation.value;
        const fullRotations = Math.round(current / (Math.PI * 2));
        gearRotation.value = withTiming(fullRotations * Math.PI * 2 + snapped, {
          duration: FG.snapDuration,
          easing: Easing.out(Easing.quad),
        });

        flashOpacity.value = withSequence(
          withTiming(0.5, { duration: 100 }),
          withTiming(0, { duration: 300 }),
        );

        setTimeout(() => triggerReveal(), FG.snapDuration + 100);
      }
    }, CONFIG.common.autoTimeout);
    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timer);
      setAutoTimeoutWarning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Pan gesture ──
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          if (idleAnimRunning.current) {
            cancelAnimation(gearRotation);
            idleAnimRunning.current = false;
          }
          const dx = e.x - cx;
          const dy = e.y - cy;
          dragStartAngle.value = Math.atan2(dy, dx);
          gearRotationOnDragStart.value = gearRotation.value;
          runOnJS(setPhase)('dragging');
        })
        .onUpdate((e) => {
          'worklet';
          const dx = e.x - cx;
          const dy = e.y - cy;
          const currentAngle = Math.atan2(dy, dx);
          const delta = currentAngle - dragStartAngle.value;
          gearRotation.value = gearRotationOnDragStart.value + delta;
        })
        .onEnd(() => {
          'worklet';
          runOnJS(checkAlignment)();
        }),
    [cx, cy, gearRotation, dragStartAngle, gearRotationOnDragStart, checkAlignment],
  );

  // ── Snap ring derived values ──
  const snapRingR = useDerivedValue(() => outerR * 1.06 + snapRingProgress.value * outerR * 0.25);
  const snapRingColor = snapFeedback?.aligned ? COLORS.snapAligned : COLORS.snapMissed;

  // ── Animated styles ──
  const gearsContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: gearsScale.value }],
    opacity: gearsOpacity.value,
  }));

  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyleAnim = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const isAligned = phase === 'aligned' || phase === 'revealed';

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Immersive dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, gearsContainerStyle]}>
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Background decorative gears */}
              <DecorGear gearPath={bgGear1Path} dgcx={bg1x} dgcy={bg1y} rotation={bgRotation1} />
              <DecorGear gearPath={bgGear2Path} dgcx={bg2x} dgcy={bg2y} rotation={bgRotation2} />

              {/* Target marker (fixed, not rotating) */}
              <Path
                path={targetArrowPath}
                color={isAligned ? COLORS.targetAligned : COLORS.targetNormal}
              />

              {/* Main gear (rotates with drag) */}
              <RotatedGearGroup
                gearPath={mainGearPath}
                gcx={cx}
                gcy={cy}
                rotation={gearRotation}
                fillColor={isAligned ? COLORS.gearAlignedFill : COLORS.gearFill}
                strokeColor={isAligned ? COLORS.gearAlignedStroke : COLORS.gearStroke}
                hubRadius={hubR}
                hubFill={COLORS.hubFill}
                hubStroke={isAligned ? COLORS.hubAlignedStroke : COLORS.hubStroke}
              />

              {/* Arrow indicator on gear (rotates with gear) */}
              <GearArrow
                arrowCx={cx}
                arrowCy={cy}
                innerDist={outerR * 0.75}
                outerDist={outerR * 0.94}
                halfWidth={outerR * 0.075}
                rotation={gearRotation}
                color={isAligned ? COLORS.arrowAligned : COLORS.arrowNormal}
              />

              {/* Snap feedback ring */}
              {snapFeedback && (
                <Group opacity={snapRingOpacity}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={snapRingR}
                    color={snapRingColor}
                    style="stroke"
                    strokeWidth={2}
                  />
                </Group>
              )}
            </Canvas>

            {/* Instruction text (inside gear container, below gear) */}
            {!isAligned && (phase === 'idle' || phase === 'dragging') && (
              <View
                style={[styles.centeredOverlay, { top: cy + outerR + 30 }]}
                pointerEvents="none"
              >
                <Text style={styles.instructionText}>转动齿轮，让 ▶ 指向 ▲</Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flash, flashStyleAnim, { backgroundColor: theme.glowColor }]}
        pointerEvents="none"
      />

      {/* Hint text */}
      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⚙️ 齿轮启动中…</Text>
        </View>
      )}
      {(phase === 'idle' || phase === 'dragging') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⚙️ 转动齿轮，让 ▶ 指向 ▲</Text>
        </View>
      )}
      {autoTimeoutWarning && (phase === 'idle' || phase === 'dragging') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.autoTimeoutWarning}>⏳ 即将自动揭晓…</Text>
        </View>
      )}
      {phase === 'aligned' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={[styles.hintText, { color: COLORS.hintAligned }]}>✨ 对准成功！</Text>
        </View>
      )}

      {/* Revealed card */}
      {(phase === 'aligned' || phase === 'revealed') && (
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
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                animate={!reducedMotion}
                onComplete={handleGlowComplete}
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject },
  centeredOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.hintText,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  autoTimeoutWarning: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 200, 50, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
});

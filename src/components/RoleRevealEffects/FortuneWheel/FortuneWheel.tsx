/**
 * FortuneWheel - 命运转盘揭示动画（Skia + RN Text + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：宝石色彩扇形 + 金色外圈转盘，每格显示角色名（RN Text），顶部固定指针。
 * 交互：Pan 拖拽/flick 旋转转盘，减速后停在玩家真实角色。
 * 停止后：闪光 → 转盘淡出 → 卡牌放大揭示。
 *
 * 角色名使用 RN Text overlay（Skia matchFont 在 web 不可用），通过
 * Animated.View rotation 同步跟随 Skia 转盘旋转。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line,
  Paint,
  Path,
  Picture,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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

// ── Immediate-mode Skia resources (reused across frames) ──
const gemRecorder = Skia.PictureRecorder();
const gemPaintRes = Skia.Paint();

// ── Static starfield picture (computed once at module level) ──
const starfieldRecorder = Skia.PictureRecorder();
const starfieldPaint = Skia.Paint();
function buildStarfieldPicture() {
  const c = starfieldRecorder.beginRecording(Skia.XYWHRect(0, 0, SCREEN_W, SCREEN_H));
  const starColor = Skia.Color('#ccccff');
  const glowColor = Skia.Color('#aaaaff');
  for (let i = 0; i < STARS.length; i++) {
    const { x, y, r } = STARS[i];
    // Glow halo
    starfieldPaint.setColor(glowColor);
    starfieldPaint.setAlphaf(0.3);
    c.drawCircle(x, y, r * 4, starfieldPaint);
    // Center dot
    starfieldPaint.setColor(starColor);
    starfieldPaint.setAlphaf(0.8);
    c.drawCircle(x, y, r, starfieldPaint);
  }
  return starfieldRecorder.finishRecordingAsPicture();
}
const STARFIELD_PICTURE = buildStarfieldPicture();

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

  // ── Picture API: batch gem bulbs (N→1 draw call, replaces N×useDerivedValue) ──
  const gemPicture = useDerivedValue(() => {
    'worklet';
    // segmentData is a JS-thread array; access its values inside worklet via closure.
    // Since segmentData is computed from useMemo (stable per layout), this is safe.
    const c = gemRecorder.beginRecording(Skia.XYWHRect(0, 0, SCREEN_W, SCREEN_H));
    for (let i = 0; i < segmentData.length; i++) {
      const seg = segmentData[i];
      const opacity = 0.5 + Math.sin(gemPulse.value + (i * Math.PI) / 3) * 0.3;
      gemPaintRes.setColor(Skia.Color(GEM_COLORS[i % GEM_COLORS.length]));
      gemPaintRes.setAlphaf(opacity);
      c.drawCircle(seg.dotX, seg.dotY, DOT_R + 2, gemPaintRes);
    }
    return gemRecorder.finishRecordingAsPicture();
  });

  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerCardReveal = useCallback(() => {
    if (enableHaptics) triggerHaptic('heavy', true);

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
              triggerHaptic('light', true);
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
  const wheelTransform = useDerivedValue(() => [{ rotate: rotation.value }]);

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

      {/* Starfield background — static Picture (pre-computed at module level) */}
      {!reducedMotion && (
        <Canvas style={styles.fullScreen} pointerEvents="none">
          <Group
            blendMode="screen"
            layer={
              <Paint>
                <Blur blur={4} />
              </Paint>
            }
          >
            <Picture picture={STARFIELD_PICTURE} />
          </Group>
        </Canvas>
      )}

      {/* Pedestal base */}
      <View style={styles.pedestal} pointerEvents="none">
        <View style={styles.pedestalTop} />
        <View style={styles.pedestalBody} />
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, wheelContainerStyle]}>
            {/* ── Skia Canvas: sectors + gold rim + center + pointer ── */}
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Rotating group: sectors + rim decorations */}
              <Group transform={wheelTransform} origin={vec(cx, cy)}>
                {/* Gold outer rim (background circle) */}
                <Circle cx={cx} cy={cy} r={wheelR} color={GOLD_DARK} />
                <Circle cx={cx} cy={cy} r={wheelR} color={GOLD} style="stroke" strokeWidth={3} />

                {/* Sector fills */}
                {segmentData.map((seg, i) => (
                  <Path key={`s-${i}`} path={seg.path} color={seg.color} />
                ))}

                {/* Gold divider lines + rim dots at segment boundaries */}
                {segmentData.map((seg, i) => (
                  <React.Fragment key={`d-${i}`}>
                    <Line
                      p1={vec(cx, cy)}
                      p2={vec(seg.edgeX, seg.edgeY)}
                      color={SEGMENT_DIVIDER}
                      strokeWidth={1.5}
                    />
                    <Circle cx={seg.dotX} cy={seg.dotY} r={DOT_R} color={GOLD} />
                  </React.Fragment>
                ))}

                {/* Inner edge circle (crisp boundary between sectors and gold rim) */}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={innerR}
                  color={GOLD_DARK}
                  style="stroke"
                  strokeWidth={1.5}
                />

                {/* Gem bulbs at rim — Picture API batch with blur */}
                <Group
                  layer={
                    <Paint>
                      <Blur blur={3} />
                    </Paint>
                  }
                >
                  <Picture picture={gemPicture} />
                </Group>
              </Group>

              {/* Static elements (don't rotate) */}
              {/* Center hub */}
              <Circle cx={cx} cy={cy} r={centerR} color={CENTER_FILL} />
              <Circle cx={cx} cy={cy} r={centerR} color={GOLD} style="stroke" strokeWidth={3} />
              <Circle
                cx={cx}
                cy={cy}
                r={centerR * 0.7}
                color={GOLD_DARK}
                style="stroke"
                strokeWidth={1}
              />
              {/* Center gem */}
              <Circle cx={cx} cy={cy} r={centerR * 0.35}>
                <RadialGradient
                  c={vec(cx - 2, cy - 2)}
                  r={centerR * 0.35}
                  colors={['#ff6666', '#cc0033', '#660019']}
                />
              </Circle>
              <Circle cx={cx - 3} cy={cy - 3} r={3} color="#ffffff" opacity={0.4}>
                <Blur blur={1} />
              </Circle>

              {/* Pointer triangle */}
              <Path path={pointerPath} color={POINTER_FILL} />
              <Path
                path={pointerPath}
                color={POINTER_STROKE_COLOR}
                style="stroke"
                strokeWidth={2}
              />
              {/* Pointer tick glow — flashes during spin */}
              <Circle
                cx={cx}
                cy={cy - wheelR - 20 + 26}
                r={8}
                opacity={useDerivedValue(() => pointerTickGlow.value * 0.6)}
              >
                <RadialGradient
                  c={vec(cx, cy - wheelR - 20 + 26)}
                  r={8}
                  colors={['#ff666680', '#ff660000']}
                />
                <Blur blur={4} />
              </Circle>
            </Canvas>

            {/* ── RN Text labels (rotate with wheel via Animated.View) ── */}
            <Animated.View style={[StyleSheet.absoluteFill, labelRotateStyle]} pointerEvents="none">
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
            <View
              style={[styles.centerTextWrap, { left: cx - 20, top: cy - 16 }]}
              pointerEvents="none"
            >
              <Text style={styles.centerText}>?</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flash, flashStyleAnim, { backgroundColor: theme.glowColor }]}
        pointerEvents="none"
      />

      {/* Phase hints */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '🎰 转盘就绪…'
            : phase === 'idle'
              ? '🎰 拨动转盘，揭晓身份'
              : phase === 'spinning'
                ? '🎰 命运转动中…'
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
          <Animated.View style={[styles.victoryArch, victoryArchStyle]} pointerEvents="none">
            <Canvas style={styles.victoryArchCanvas}>
              <Circle cx={cardWidth / 2 + 20} cy={cardHeight / 2 + 20} r={cardWidth * 0.7}>
                <RadialGradient
                  c={vec(cardWidth / 2 + 20, cardHeight / 2 + 20)}
                  r={cardWidth * 0.7}
                  colors={[`${GOLD}00`, `${GOLD}30`, `${GOLD}00`]}
                />
              </Circle>
              {/* Ray lines */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (Math.PI * 2 * i) / 8;
                const ir = cardWidth * 0.45;
                const or = cardWidth * 0.65;
                return (
                  <Line
                    key={`ray-${i}`}
                    p1={vec(
                      cardWidth / 2 + 20 + Math.cos(angle) * ir,
                      cardHeight / 2 + 20 + Math.sin(angle) * ir,
                    )}
                    p2={vec(
                      cardWidth / 2 + 20 + Math.cos(angle) * or,
                      cardHeight / 2 + 20 + Math.sin(angle) * or,
                    )}
                    color={GOLD}
                    strokeWidth={2}
                    style="stroke"
                  >
                    <Blur blur={3} />
                  </Line>
                );
              })}
            </Canvas>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  flash: { ...StyleSheet.absoluteFillObject },
  pedestal: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
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
  },
  centerText: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '900',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.5)', 0, 1, 2),
  },
});

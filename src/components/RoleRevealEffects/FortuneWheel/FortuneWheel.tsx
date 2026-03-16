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
import { Canvas, Circle, Group, Line, Path, vec } from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { useColors } from '@/theme';

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
const HINT_TEXT_COLOR = 'rgba(255, 255, 255, 0.85)';
const HINT_ALIGNED_COLOR = '#4ECDC4';

const FW = CONFIG.fortuneWheel;

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
  const appColors = useColors();
  const alignmentThemes = useMemo(() => createAlignmentThemes(appColors), [appColors]);
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
  const [autoTimeoutWarning, setAutoTimeoutWarning] = useState(false);
  const onCompleteCalledRef = useRef(false);

  const wheelOpacity = useSharedValue(0);
  const wheelScaleVal = useSharedValue(0);
  const rotation = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScaleVal = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const dragStartAngle = useSharedValue(0);
  const rotationOnDragStart = useSharedValue(0);

  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete();
  }, [onComplete]);

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
  }, [canvasOpacity, cardScaleVal, cardOpacity, flashOpacity, enableHaptics, enterRevealed]);

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
    wheelScaleVal.value = withTiming(
      1,
      { duration: FW.appearDuration, easing: Easing.out(Easing.back(1.15)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );
  }, [reducedMotion, wheelOpacity, wheelScaleVal, cardScaleVal, cardOpacity, canvasOpacity]);

  // Deceleration spin to target
  const startDeceleratingToTarget = useCallback(() => {
    setPhase('spinning');
    const finalRotation = computeTargetRotation(rotation.value);
    const duration = 2500 + Math.random() * 1000;

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
  }, [computeTargetRotation, rotation, enableHaptics]);

  // Trigger card reveal when wheel stops
  useEffect(() => {
    if (phase !== 'stopped') return;
    const timer = setTimeout(() => triggerCardReveal(), 400);
    return () => clearTimeout(timer);
  }, [phase, triggerCardReveal]);

  // Auto-spin timeout
  useEffect(() => {
    if (phase !== 'idle') return;
    const warningTimer = setTimeout(
      () => setAutoTimeoutWarning(true),
      CONFIG.common.autoTimeout - CONFIG.common.autoTimeoutWarningLeadTime,
    );
    const timer = setTimeout(() => {
      rotation.value = rotation.value + Math.PI * 0.5;
      startDeceleratingToTarget();
    }, CONFIG.common.autoTimeout);
    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timer);
      setAutoTimeoutWarning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

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

              {/* Pointer triangle */}
              <Path path={pointerPath} color={POINTER_FILL} />
              <Path
                path={pointerPath}
                color={POINTER_STROKE_COLOR}
                style="stroke"
                strokeWidth={2}
              />
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
      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🎰 转盘就绪…</Text>
        </View>
      )}
      {phase === 'idle' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🎰 拨动转盘，揭晓身份</Text>
        </View>
      )}
      {phase === 'spinning' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🎰 命运转动中…</Text>
        </View>
      )}
      {phase === 'stopped' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={[styles.hintText, { color: HINT_ALIGNED_COLOR }]}>✨ 命运已定！</Text>
        </View>
      )}
      {autoTimeoutWarning && phase === 'idle' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.autoTimeoutWarning}>⏳ 即将自动揭晓…</Text>
        </View>
      )}

      {/* Card reveal */}
      {(phase === 'stopped' || phase === 'revealed') && (
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
  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 20,
    fontWeight: '700',
    color: HINT_TEXT_COLOR,
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
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

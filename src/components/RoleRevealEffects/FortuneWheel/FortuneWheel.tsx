/**
 * FortuneWheel - 命运转盘揭示动画（Skia + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：彩色扇形转盘，每格显示角色名+阵营色，顶部固定指针。
 * 交互：Pan 拖拽/flick 旋转转盘，减速后停在玩家真实角色。
 * 停止后：闪光 → 转盘淡出 → 卡牌放大揭示。
 *
 * 不 import service，不含业务逻辑。
 */
import {
  Canvas,
  Circle,
  Group,
  Line,
  matchFont,
  Path,
  type SkFont,
  Text as SkText,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
const BG_GRADIENT = ['#08081a', '#0c0c24', '#08081a'] as const;

const SEGMENT_COLORS = [
  'rgba(108, 99, 255, 0.35)',
  'rgba(78, 205, 196, 0.30)',
  'rgba(255, 136, 68, 0.30)',
  'rgba(255, 99, 132, 0.30)',
  'rgba(130, 202, 157, 0.30)',
  'rgba(182, 137, 255, 0.30)',
  'rgba(255, 206, 86, 0.30)',
  'rgba(100, 181, 246, 0.30)',
] as const;

const SEGMENT_STROKE = 'rgba(255, 255, 255, 0.15)';
const CENTER_FILL = '#1a1a2e';
const CENTER_STROKE = 'rgba(108, 99, 255, 0.6)';
const POINTER_COLOR = '#FF4444';
const POINTER_STROKE = '#FFFFFF';
const HINT_TEXT_COLOR = 'rgba(255, 255, 255, 0.85)';
const HINT_ALIGNED_COLOR = '#4ECDC4';

const FW = CONFIG.fortuneWheel;

// ─── Font ──────────────────────────────────────────────────────────────
const skFont: SkFont = matchFont({
  fontFamily: Platform.select({ ios: 'PingFang SC', default: 'sans-serif' }),
  fontSize: 14,
  fontWeight: '600' as const,
});

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
  const centerR = wheelR * 0.15;

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
      const labelDist = wheelR * 0.65;
      const labelX = cx + labelDist * Math.cos(midAngle);
      const labelY = cy + labelDist * Math.sin(midAngle);
      const labelAngle = midAngle + Math.PI / 2;
      const displayLabel = seg.name.length > 4 ? seg.name.slice(0, 4) : seg.name;

      return {
        path: buildSectorPath(cx, cy, wheelR, startAngle, endAngle),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        displayLabel,
        labelX,
        labelY,
        labelAngle,
      };
    });
  }, [segments, segmentAngle, wheelR, cx, cy]);

  const pointerPath = useMemo(() => buildPointerPath(cx, cy - wheelR - 18, 22), [cx, cy, wheelR]);

  const tickMarks = useMemo(() => {
    const ticks: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const tickCount = segmentCount * 2;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2 - Math.PI / 2;
      const r1 = wheelR * 0.96;
      const r2 = i % 2 === 0 ? wheelR : wheelR * 0.98;
      ticks.push({
        x1: cx + r1 * Math.cos(angle),
        y1: cy + r1 * Math.sin(angle),
        x2: cx + r2 * Math.cos(angle),
        y2: cy + r2 * Math.sin(angle),
      });
    }
    return ticks;
  }, [segmentCount, wheelR, cx, cy]);

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
      const targetMidOffset = targetIndex * segmentAngle;
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

  const wheelTransform = useDerivedValue(() => [{ rotate: rotation.value }]);

  const wheelContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wheelScaleVal.value }],
    opacity: wheelOpacity.value,
  }));

  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScaleVal.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyleAnim = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

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
            <Canvas style={StyleSheet.absoluteFill}>
              <Group transform={wheelTransform} origin={vec(cx, cy)}>
                {segmentData.map((seg, i) => (
                  <React.Fragment key={i}>
                    <Path path={seg.path} color={seg.color} />
                    <Path path={seg.path} color={SEGMENT_STROKE} style="stroke" strokeWidth={1} />
                    <Group
                      transform={[{ rotate: seg.labelAngle }]}
                      origin={vec(seg.labelX, seg.labelY)}
                    >
                      <SkText
                        x={seg.labelX - (seg.displayLabel.length * 14) / 2}
                        y={seg.labelY + 5}
                        text={seg.displayLabel}
                        font={skFont}
                        color="rgba(255, 255, 255, 0.9)"
                      />
                    </Group>
                  </React.Fragment>
                ))}
                {tickMarks.map((t, i) => (
                  <Line
                    key={`t-${i}`}
                    p1={vec(t.x1, t.y1)}
                    p2={vec(t.x2, t.y2)}
                    color="rgba(255, 255, 255, 0.2)"
                    strokeWidth={1}
                  />
                ))}
              </Group>

              <Circle cx={cx} cy={cy} r={centerR} color={CENTER_FILL} />
              <Circle
                cx={cx}
                cy={cy}
                r={centerR}
                color={CENTER_STROKE}
                style="stroke"
                strokeWidth={2}
              />
              <SkText
                x={cx - 7}
                y={cy + 5}
                text="?"
                font={skFont}
                color="rgba(255, 255, 255, 0.6)"
              />

              <Path path={pointerPath} color={POINTER_COLOR} />
              <Path path={pointerPath} color={POINTER_STROKE} style="stroke" strokeWidth={1.5} />
            </Canvas>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        style={[styles.flash, flashStyleAnim, { backgroundColor: theme.glowColor }]}
        pointerEvents="none"
      />

      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⚙️ 转盘就绪…</Text>
        </View>
      )}
      {phase === 'idle' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⚙️ 拨动转盘，揭晓身份</Text>
        </View>
      )}
      {phase === 'spinning' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⚙️ 命运转动中…</Text>
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
});

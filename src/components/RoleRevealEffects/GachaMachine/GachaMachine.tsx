/**
 * GachaMachine - 复古日式扭蛋机揭示效果（Reanimated 4）
 *
 * 特点：圆形透明球体顶部、投币口、旋转手柄、扭蛋滚出 → 打开 → 揭示。
 * 使用 `useSharedValue` 驱动所有动画，`runOnJS` 切换阶段。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import type { RoleId } from '@/models/roles';
import { borderRadius } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const CAPSULE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#DDA0DD',
  '#87CEEB',
  '#F0E68C',
];

const GACHA_COLORS = {
  bodyGradient: ['#FF7F7F', '#FF6B6B', '#E55555'] as const,
  backgroundGradient: ['#FFF5E6', '#FFE4CC', '#FFF5E6'] as const,
  baseGradient: ['#666', '#444', '#333'] as const,
  coinSlotBg: '#333',
  coinSlotInnerBg: '#111',
  labelBg: '#FFF',
  labelText: '#FF6B6B',
  outletBg: '#222',
  outletInnerBg: '#111',
  dialCenterBg: '#FFD700',
  dialCenterBorder: '#DAA520',
  dialArmBg: '#888',
  dialKnobBg: '#E74C3C',
  dialKnobBorder: '#C0392B',
  hintTextColor: '#D35400',
  capsuleTopBg: '#FF69B4',
  capsuleBottomBg: '#FFF',
  capsuleRingBg: '#EEE',
  capsuleRingBorder: '#DDD',
};

// ─── Tiny capsule inside dome ───────────────────────────────────────────
const TinyCapsule: React.FC<{
  angle: number;
  distance: number;
  color: string;
  size: number;
}> = React.memo(({ angle, distance, color, size }) => {
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance + 10;
  return (
    <View
      style={[
        styles.tinyCapsule,
        {
          left: 75 + x - size / 2,
          top: 75 + y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <View
        style={[styles.tinyCapsuleShine, { width: size * 0.3, height: size * 0.3 }]}
      />
    </View>
  );
});
TinyCapsule.displayName = 'TinyCapsule';

// ─── Main component ─────────────────────────────────────────────────────
export const GachaMachine: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'gacha-machine',
}) => {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const config = CONFIG.gachaMachine ?? { revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<
    'ready' | 'spinning' | 'dropping' | 'waiting' | 'opening' | 'revealed'
  >('ready');
  const onCompleteCalledRef = useRef(false);

  const { width: screenWidth } = Dimensions.get('window');
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Shared values ──
  const dialRotation = useSharedValue(0);
  const capsuleY = useSharedValue(-30);
  const capsuleOpacity = useSharedValue(0);
  const capsuleRotate = useSharedValue(0);
  const shellScale = useSharedValue(1);
  const shellOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const machineOpacityAnim = useSharedValue(1);
  const bobble = useSharedValue(0);

  // Random tiny capsules (stable across re-renders)
  const [tinyCapsules] = useState(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      result.push({
        id: i,
        angle: ((Math.PI * 2) / 12) * i + Math.random() * 0.5,
        distance: 25 + Math.random() * 35,
        color: CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)],
        size: 14 + Math.random() * 10,
      });
    }
    return result;
  });

  // ── Bobble animation for dome ──
  useEffect(() => {
    if (phase !== 'ready' || reducedMotion) return;

    bobble.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(bobble);
      bobble.value = 0;
    };
  }, [phase, reducedMotion, bobble]);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    machineOpacityAnim.value = withTiming(0, { duration: 300 });
  }, [machineOpacityAnim]);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 1200);
    return () => clearTimeout(timer);
  }, [onComplete, config.revealHoldDuration]);

  // Open capsule → reveal card
  const openCapsule = useCallback(() => {
    if (phase !== 'waiting') return;
    setPhase('opening');
    if (enableHaptics) triggerHaptic('heavy', true);

    // Shell explodes outward
    shellScale.value = withTiming(1.3, { duration: 250 });
    shellOpacity.value = withTiming(0, { duration: 250 });

    // Card springs in after 200ms delay
    cardScale.value = withDelay(
      200,
      withSpring(1, { damping: 10, stiffness: 60 }, (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      }),
    );
    cardOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
  }, [
    phase,
    shellScale,
    shellOpacity,
    cardScale,
    cardOpacity,
    enableHaptics,
    enterRevealed,
  ]);

  const enterWaiting = useCallback(() => {
    setPhase('waiting');
  }, []);

  // Spin dial → drop capsule
  const spinDial = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('spinning');
    if (enableHaptics) triggerHaptic('medium', true);

    dialRotation.value = withTiming(
      360,
      { duration: 600, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;

        // Phase: dropping
        runOnJS(setPhase)('dropping');
        capsuleOpacity.value = 1;

        capsuleY.value = withTiming(
          200,
          { duration: 800, easing: Easing.bounce },
          (fin2) => {
            'worklet';
            if (fin2) runOnJS(enterWaiting)();
          },
        );
        capsuleRotate.value = withTiming(540, { duration: 800 });
      },
    );
  }, [
    phase,
    dialRotation,
    capsuleY,
    capsuleOpacity,
    capsuleRotate,
    enableHaptics,
    enterWaiting,
  ]);

  // ── Reduced motion ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      shellOpacity.value = 0;
      machineOpacityAnim.value = 0;
      setPhase('revealed');
    }
  }, [reducedMotion, cardScale, cardOpacity, shellOpacity, machineOpacityAnim]);

  // ── Auto-spin after 1.5s ──
  useEffect(() => {
    if (phase !== 'ready' || reducedMotion) return;
    const timer = setTimeout(() => spinDial(), 1500);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, spinDial]);

  // ── Auto-open capsule after 1s ──
  useEffect(() => {
    if (phase !== 'waiting' || reducedMotion) return;
    const timer = setTimeout(() => openCapsule(), 1000);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, openCapsule]);

  // ── Animated styles ──
  const bobbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bobble.value }],
  }));

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${dialRotation.value}deg` }],
  }));

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value * shellOpacity.value,
    transform: [
      { translateY: capsuleY.value },
      { scale: shellScale.value },
      { rotate: `${capsuleRotate.value}deg` },
    ],
  }));

  const machineOpacityStyle = useAnimatedStyle(() => ({
    opacity: machineOpacityAnim.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  // ── Render ──
  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <LinearGradient
        colors={[...GACHA_COLORS.backgroundGradient]}
        style={StyleSheet.absoluteFill}
      />

      {/* Machine - fades out on reveal */}
      <Animated.View
        style={[styles.machine, machineOpacityStyle]}
        pointerEvents={phase === 'revealed' ? 'none' : 'auto'}
      >
          {/* Dome */}
          <Animated.View style={[styles.dome, bobbleStyle]}>
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.9)',
                'rgba(200,220,255,0.6)',
                'rgba(255,255,255,0.8)',
              ]}
              style={styles.domeGradient}
            />
            {tinyCapsules.map((c) => (
              <TinyCapsule
                key={c.id}
                angle={c.angle}
                distance={c.distance}
                color={c.color}
                size={c.size}
              />
            ))}
            <View style={styles.domeHighlight} />
          </Animated.View>

          {/* Body */}
          <View style={styles.body}>
            <LinearGradient
              colors={[...GACHA_COLORS.bodyGradient]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.coinSlot}>
              <View style={styles.coinSlotInner} />
            </View>
            <View style={styles.label}>
              <Text style={styles.labelText}>GACHA</Text>
            </View>
            <View style={styles.outlet}>
              <View style={styles.outletInner} />
            </View>
          </View>

          {/* Dial */}
          <Pressable onPress={spinDial} style={styles.dialContainer}>
            <Animated.View style={[styles.dial, dialStyle]}>
              <View style={styles.dialCenter} />
              <View style={styles.dialArm} />
              <View style={styles.dialKnob} />
            </Animated.View>
          </Pressable>

          {/* Base */}
          <View style={styles.base}>
            <LinearGradient
              colors={[...GACHA_COLORS.baseGradient]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>

      {/* Hints */}
      {phase === 'ready' && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>🎯 点击转盘抽蛋!</Text>
        </View>
      )}
      {phase === 'waiting' && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>✨ 点击扭蛋打开!</Text>
        </View>
      )}

      {/* Falling capsule */}
      {(phase === 'dropping' || phase === 'waiting' || phase === 'opening') && (
        <Animated.View style={[styles.capsule, capsuleStyle]}>
          <Pressable onPress={openCapsule} style={styles.capsuleTouch}>
            <View style={styles.capsuleTop}>
              <View style={styles.capsuleTopShine} />
            </View>
            <View style={styles.capsuleBottom} />
            <View style={styles.capsuleRing} />
          </Pressable>
        </Animated.View>
      )}

      {/* Revealed card */}
      {(phase === 'opening' || phase === 'revealed') && (
        <Animated.View style={[styles.cardWrapper, cardStyle]}>
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
          />
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
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  machine: { alignItems: 'center' },

  dome: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  domeGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 75 },
  domeHighlight: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 40,
    height: 25,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    transform: [{ rotate: '-30deg' }],
  },
  tinyCapsule: { position: 'absolute' },
  tinyCapsuleShine: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
  },

  body: {
    width: 160,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: -10,
    alignItems: 'center',
  },
  coinSlot: {
    marginTop: 12,
    width: 50,
    height: 8,
    backgroundColor: GACHA_COLORS.coinSlotBg,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinSlotInner: {
    width: 30,
    height: 3,
    backgroundColor: GACHA_COLORS.coinSlotInnerBg,
    borderRadius: 2,
  },
  label: {
    marginTop: 8,
    backgroundColor: GACHA_COLORS.labelBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '900',
    color: GACHA_COLORS.labelText,
    letterSpacing: 2,
  },
  outlet: {
    position: 'absolute',
    bottom: 10,
    width: 60,
    height: 35,
    backgroundColor: GACHA_COLORS.outletBg,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outletInner: {
    width: 50,
    height: 25,
    backgroundColor: GACHA_COLORS.outletInnerBg,
    borderRadius: 6,
  },

  dialContainer: {
    position: 'absolute',
    right: -50,
    top: 160,
    width: 60,
    height: 60,
  },
  dial: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialCenter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GACHA_COLORS.dialCenterBg,
    borderWidth: 3,
    borderColor: GACHA_COLORS.dialCenterBorder,
  },
  dialArm: {
    position: 'absolute',
    width: 8,
    height: 35,
    backgroundColor: GACHA_COLORS.dialArmBg,
    borderRadius: 4,
    top: -5,
  },
  dialKnob: {
    position: 'absolute',
    top: -15,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GACHA_COLORS.dialKnobBg,
    borderWidth: 2,
    borderColor: GACHA_COLORS.dialKnobBorder,
  },

  base: {
    width: 180,
    height: 25,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },

  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 22,
    fontWeight: '700',
    color: GACHA_COLORS.hintTextColor,
  },

  capsule: { position: 'absolute', width: 80, height: 80 },
  capsuleTouch: { width: '100%', height: '100%' },
  capsuleTop: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: '52%',
    backgroundColor: GACHA_COLORS.capsuleTopBg,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  capsuleTopShine: {
    position: 'absolute',
    top: 8,
    left: 15,
    width: 20,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
  },
  capsuleBottom: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '52%',
    backgroundColor: GACHA_COLORS.capsuleBottomBg,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  capsuleRing: {
    position: 'absolute',
    top: '46%',
    width: '100%',
    height: 8,
    backgroundColor: GACHA_COLORS.capsuleRingBg,
    borderWidth: 1,
    borderColor: GACHA_COLORS.capsuleRingBorder,
  },

  cardWrapper: { alignItems: 'center', justifyContent: 'center' },
  glowBorder: { position: 'absolute', top: -4, left: -4 },
});

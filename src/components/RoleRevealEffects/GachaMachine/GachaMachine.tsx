/**
 * GachaMachine - 复古日式扭蛋机揭示效果（Reanimated 4 + Skia）
 *
 * 动画流程：旋转灯 + 投币口 → 金币滑入 → 旋转手柄 → 球体翻滚 →
 * 扭蛋从出口滑出 → 裂纹显现 → 打开 → 星星纷飞 + 稀有度标签。
 * 使用 `useSharedValue` 驱动所有动画，`runOnJS` 切换阶段。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { crossPlatformTextShadow, useColors } from '@/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  hintTextColor: 'rgba(255, 255, 255, 0.85)',
  capsuleTopBg: '#FF69B4',
  capsuleBottomBg: '#FFF',
  capsuleRingBg: '#EEE',
  capsuleRingBorder: '#DDD',
  coin: '#FFD700',
  coinEdge: '#DAA520',
  rotaryRed: '#ff3333',
  rotaryYellow: '#ffdd33',
  rotaryGreen: '#33dd66',
  rotaryBlue: '#3388ff',
  confettiGold: '#ffd700',
  confettiPink: '#ff69b4',
  confettiCyan: '#00e5ff',
  crackLine: '#333333',
};

// Rarity tier per alignment
const RARITY_LABEL: Record<string, { tier: string; color: string }> = {
  wolf: { tier: 'SSR', color: '#ff3366' },
  god: { tier: 'SSR', color: '#ffd700' },
  villager: { tier: 'SR', color: '#66bbff' },
  third: { tier: 'UR', color: '#cc66ff' },
};

// Rotary light positions around the machine body
const ROTARY_LIGHTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 8;
  return {
    x: SCREEN_W / 2 + Math.cos(angle) * 100,
    y: SCREEN_H * 0.42 + Math.sin(angle) * 70,
    color: [
      GACHA_COLORS.rotaryRed,
      GACHA_COLORS.rotaryYellow,
      GACHA_COLORS.rotaryGreen,
      GACHA_COLORS.rotaryBlue,
    ][i % 4],
    phase: (i * Math.PI) / 4,
  };
});

// Confetti star positions
const CONFETTI_STARS = Array.from({ length: 16 }, (_, i) => ({
  angle: (Math.PI * 2 * i) / 16 + (((i * 37) % 10) / 10) * 0.3,
  speed: 60 + ((i * 53) % 40),
  r: 2 + ((i * 23) % 3),
  color: [GACHA_COLORS.confettiGold, GACHA_COLORS.confettiPink, GACHA_COLORS.confettiCyan][i % 3],
}));

// ─── Self-animating Skia sub-components (hooks must live in own component) ──

interface SkiaRotaryLightProps {
  x: number;
  y: number;
  color: string;
  phase: number;
  rotaryLightCycle: SharedValue<number>;
}

const SkiaRotaryLight: React.FC<SkiaRotaryLightProps> = React.memo(
  ({ x, y, color, phase, rotaryLightCycle }) => {
    const opacity = useDerivedValue(() => 0.3 + Math.sin(rotaryLightCycle.value + phase) * 0.3);
    const glowOpacity = useDerivedValue(() => opacity.value * 0.3);
    return (
      <Group>
        <Circle cx={x} cy={y} r={6} color={color} opacity={opacity}>
          <Blur blur={4} />
        </Circle>
        <Circle cx={x} cy={y} r={12} opacity={glowOpacity}>
          <RadialGradient c={vec(x, y)} r={12} colors={[`${color}60`, `${color}00`]} />
          <Blur blur={6} />
        </Circle>
      </Group>
    );
  },
);
SkiaRotaryLight.displayName = 'SkiaRotaryLight';

interface SkiaConfettiStarProps {
  angle: number;
  speed: number;
  r: number;
  color: string;
  confettiProgress: SharedValue<number>;
  confettiOpacity: SharedValue<number>;
}

const SkiaConfettiStar: React.FC<SkiaConfettiStarProps> = React.memo(
  ({ angle, speed, r, color, confettiProgress, confettiOpacity }) => {
    const cx = useDerivedValue(
      () => SCREEN_W / 2 + Math.cos(angle) * speed * confettiProgress.value,
    );
    const cy = useDerivedValue(
      () =>
        SCREEN_H / 2 +
        Math.sin(angle) * speed * confettiProgress.value -
        20 * confettiProgress.value,
    );
    const op = useDerivedValue(() => confettiOpacity.value);
    return (
      <Circle cx={cx} cy={cy} r={r} color={color} opacity={op}>
        <Blur blur={1} />
      </Circle>
    );
  },
);
SkiaConfettiStar.displayName = 'SkiaConfettiStar';

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
      {/* Specular highlight — bright off-center dot */}
      <View
        style={[
          styles.tinyCapsuleShine,
          {
            width: size * 0.35,
            height: size * 0.35,
            top: size * 0.12,
            left: size * 0.15,
          },
        ]}
      />
      {/* Bottom shadow crescent */}
      <View
        style={[
          styles.capsuleShadow,
          {
            height: size * 0.35,
            borderBottomLeftRadius: size / 2,
            borderBottomRightRadius: size / 2,
          },
        ]}
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
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

  // Scene element shared values
  const rotaryLightCycle = useSharedValue(0);
  const coinSlideY = useSharedValue(-40);
  const coinOpacity = useSharedValue(0);
  const crackOpacity = useSharedValue(0);
  const confettiProgress = useSharedValue(0);
  const confettiOpacity = useSharedValue(0);
  const rarityOpacity = useSharedValue(0);
  const rarityScale = useSharedValue(0.5);

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

  // ── Bobble animation for dome + rotary lights ──
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

    // Rotary lights cycle
    rotaryLightCycle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }),
      -1,
    );

    return () => {
      cancelAnimation(bobble);
      bobble.value = 0;
    };
  }, [phase, reducedMotion, bobble, rotaryLightCycle]);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    machineOpacityAnim.value = withTiming(0, { duration: 300 });

    // Confetti burst
    confettiOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(800, withTiming(0, { duration: 400 })),
    );
    confettiProgress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });

    // Rarity label pop-in
    rarityOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    rarityScale.value = withDelay(
      300,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
    );
  }, [machineOpacityAnim, confettiOpacity, confettiProgress, rarityOpacity, rarityScale]);

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

    // Crack lines appear before shell bursts
    crackOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(100, withTiming(0, { duration: 200 })),
    );

    // Shell explodes outward
    shellScale.value = withTiming(1.3, { duration: 250 });
    shellOpacity.value = withTiming(0, { duration: 250 });

    // Card scales in after 200ms delay (deterministic timing, no spring oscillation)
    cardScale.value = withDelay(
      200,
      withTiming(1, { duration: 250, easing: Easing.out(Easing.back(1.2)) }, (finished) => {
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
    crackOpacity,
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

    // Coin insert animation
    coinOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(300, withTiming(0, { duration: 200 })),
    );
    coinSlideY.value = withTiming(10, { duration: 300, easing: Easing.in(Easing.cubic) });

    dialRotation.value = withTiming(
      360,
      { duration: 600, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;

        // Phase: dropping
        runOnJS(setPhase)('dropping');
        capsuleOpacity.value = 1;

        capsuleY.value = withTiming(200, { duration: 800, easing: Easing.bounce }, (fin2) => {
          'worklet';
          if (fin2) runOnJS(enterWaiting)();
        });
        capsuleRotate.value = withTiming(540, { duration: 800 });
      },
    );
  }, [
    phase,
    dialRotation,
    capsuleY,
    capsuleOpacity,
    capsuleRotate,
    coinOpacity,
    coinSlideY,
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
      const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 0);
      return () => clearTimeout(timer);
    }
  }, [
    reducedMotion,
    cardScale,
    cardOpacity,
    shellOpacity,
    machineOpacityAnim,
    onComplete,
    config.revealHoldDuration,
  ]);

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

  const rarityStyle = useAnimatedStyle(() => ({
    opacity: rarityOpacity.value,
    transform: [{ scale: rarityScale.value }],
  }));

  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value,
    transform: [{ translateY: coinSlideY.value }],
  }));

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackOpacity.value,
  }));

  // ── Render ──
  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <LinearGradient
        colors={[...GACHA_COLORS.backgroundGradient]}
        style={StyleSheet.absoluteFill}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Skia scene layer: rotary lights + confetti */}
      {!reducedMotion && (
        <Canvas style={styles.fullScreen} pointerEvents="none">
          {/* Rotary lights around machine */}
          {ROTARY_LIGHTS.map((light, i) => (
            <SkiaRotaryLight
              key={`rlight-${i}`}
              x={light.x}
              y={light.y}
              color={light.color}
              phase={light.phase}
              rotaryLightCycle={rotaryLightCycle}
            />
          ))}

          {/* Confetti stars burst on reveal */}
          {phase === 'revealed' &&
            CONFETTI_STARS.map((star, i) => (
              <SkiaConfettiStar
                key={`confetti-${i}`}
                angle={star.angle}
                speed={star.speed}
                r={star.r}
                color={star.color}
                confettiProgress={confettiProgress}
                confettiOpacity={confettiOpacity}
              />
            ))}
        </Canvas>
      )}

      {/* Machine - fades out on reveal */}
      <Animated.View
        style={[styles.machine, machineOpacityStyle]}
        pointerEvents={phase === 'revealed' ? 'none' : 'auto'}
      >
        {/* Dome */}
        <Animated.View style={[styles.dome, bobbleStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(200,220,255,0.6)', 'rgba(255,255,255,0.8)']}
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
          <LinearGradient colors={[...GACHA_COLORS.bodyGradient]} style={StyleSheet.absoluteFill} />
          <View style={styles.coinSlot}>
            <View style={styles.coinSlotInner} />
            {/* Animated coin insert */}
            <Animated.View style={[styles.coin, coinStyle]} pointerEvents="none">
              <Text style={styles.coinSymbol}>¥</Text>
            </Animated.View>
          </View>
          <View style={styles.label}>
            <Text style={styles.labelText}>GACHA</Text>
          </View>
          <View style={styles.outlet}>
            <View style={styles.outletInner} />
          </View>
          {/* Exit slide chute */}
          <View style={styles.exitSlide} />
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
          <LinearGradient colors={[...GACHA_COLORS.baseGradient]} style={StyleSheet.absoluteFill} />
        </View>
      </Animated.View>

      {/* Hints */}
      {phase === 'ready' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🎯 点击旋钮开始</Text>
        </View>
      )}
      {(phase === 'spinning' || phase === 'dropping') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🎰 扭蛋掉落中…</Text>
        </View>
      )}
      {phase === 'waiting' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>✨ 点击扭蛋打开</Text>
        </View>
      )}

      {/* Falling capsule */}
      {(phase === 'dropping' || phase === 'waiting' || phase === 'opening') && (
        <Animated.View style={[styles.capsule, capsuleStyle]}>
          <Pressable onPress={openCapsule} style={styles.capsuleTouch}>
            <View style={styles.capsuleTop}>
              <View style={styles.capsuleTopShine} />
              {/* Star pattern on capsule */}
              <Text style={styles.capsuleStarPattern}>★</Text>
            </View>
            <View style={styles.capsuleBottom}>
              {/* Star pattern on bottom half */}
              <Text style={styles.capsuleStarPatternBottom}>✦</Text>
            </View>
            <View style={styles.capsuleRing} />
            {/* Crack lines — appear before opening */}
            <Animated.View style={[styles.crackOverlay, crackStyle]} pointerEvents="none">
              <Text style={styles.crackLine}>╲</Text>
              <Text style={styles.crackLine}>╱</Text>
              <Text style={styles.crackLine}>│</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}

      {/* Revealed card */}
      {(phase === 'opening' || phase === 'revealed') && (
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
                onComplete={handleGlowComplete}
              />
            )}
          </View>
        </Animated.View>
      )}

      {/* Rarity label — pops in after reveal */}
      {phase === 'revealed' && (
        <Animated.View
          style={[styles.rarityContainer, { top: insets.top + 60 }, rarityStyle]}
          pointerEvents="none"
        >
          <Text
            style={[styles.rarityText, { color: RARITY_LABEL[role.alignment]?.color ?? '#66bbff' }]}
          >
            {RARITY_LABEL[role.alignment]?.tier ?? 'SR'}
          </Text>
        </Animated.View>
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
  tinyCapsule: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  capsuleShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
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
    ...Platform.select({
      web: { textShadow: '0px 1px 4px rgba(0, 0, 0, 0.6)' },
      native: {
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      },
    }),
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

  cardWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardInner: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glowBorder: { position: 'absolute', top: -4, left: -4 },
  coin: {
    position: 'absolute',
    top: -20,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GACHA_COLORS.coin,
    borderWidth: 2,
    borderColor: GACHA_COLORS.coinEdge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinSymbol: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8B6914',
  },
  exitSlide: {
    position: 'absolute',
    bottom: -8,
    width: 70,
    height: 12,
    backgroundColor: '#555',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ perspective: 200 }, { rotateX: '20deg' }],
  },
  capsuleStarPattern: {
    position: 'absolute',
    top: 15,
    right: 18,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  capsuleStarPatternBottom: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    fontSize: 8,
    color: 'rgba(0,0,0,0.1)',
  },
  crackOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  crackLine: {
    fontSize: 20,
    color: GACHA_COLORS.crackLine,
    opacity: 0.7,
    marginHorizontal: 2,
  },
  rarityContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  rarityText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
    ...crossPlatformTextShadow('#00000066', 0, 2, 6),
  },
});

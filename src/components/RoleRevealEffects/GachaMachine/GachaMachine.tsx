/**
 * GachaMachine - 复古日式扭蛋机揭示效果（CSS Transitions + Canvas）
 *
 * 动画流程：旋转灯 + 投币口 → 金币滑入 → 旋转手柄 → 球体翻滚 →
 * 扭蛋从出口滑出 → 裂纹显现 → 打开 → 星星纷飞 + 稀有度标签。
 * 使用 CSS transitions/animations 驱动所有动画。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { colors, crossPlatformTextShadow } from '@/theme';

import GachaMachineCanvas from './GachaMachineCanvas';

// Register keyframes for bobble animation
registerKeyframes(
  'gachaBobble',
  '0%{transform:translateY(3px)}50%{transform:translateY(-3px)}100%{transform:translateY(3px)}',
);

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
function createRotaryLights(screenW: number, screenH: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 8;
    return {
      x: screenW / 2 + Math.cos(angle) * 100,
      y: screenH * 0.42 + Math.sin(angle) * 70,
      color: [
        GACHA_COLORS.rotaryRed,
        GACHA_COLORS.rotaryYellow,
        GACHA_COLORS.rotaryGreen,
        GACHA_COLORS.rotaryBlue,
      ][i % 4]!,
      phase: (i * Math.PI) / 4,
    };
  });
}

// Confetti star positions
const CONFETTI_STARS = Array.from({ length: 16 }, (_, i) => ({
  angle: (Math.PI * 2 * i) / 16 + (((i * 37) % 10) / 10) * 0.3,
  speed: 60 + ((i * 53) % 40),
  r: 2 + ((i * 23) % 3),
  color: [GACHA_COLORS.confettiGold, GACHA_COLORS.confettiPink, GACHA_COLORS.confettiCyan][i % 3]!,
}));

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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const rotaryLights = useMemo(
    () => createRotaryLights(screenWidth, screenHeight),
    [screenWidth, screenHeight],
  );
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.gachaMachine ?? { revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<
    'ready' | 'spinning' | 'dropping' | 'waiting' | 'opening' | 'revealed'
  >('ready');
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Shared values ──
  const [dialRotation, setDialRotation] = useState(0);
  const [capsuleY, setCapsuleY] = useState(-30);
  const [capsuleOpacity, setCapsuleOpacity] = useState(0);
  const [capsuleRotate, setCapsuleRotate] = useState(0);
  const [shellScale, setShellScale] = useState(1);
  const [shellOpacity, setShellOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [machineOpacity, setMachineOpacity] = useState(1);
  const [bobbleActive, setBobbleActive] = useState(false);

  // Scene element states
  const [coinSlideY, setCoinSlideY] = useState(-40);
  const [coinOpacity, setCoinOpacity] = useState(0);
  const [crackOpacity, setCrackOpacity] = useState(0);
  const [rarityOpacity, setRarityOpacity] = useState(0);
  const [rarityScale, setRarityScale] = useState(0.5);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // Track confetti start time for canvas component
  const [confettiStartTime, setConfettiStartTime] = useState(0);

  // Random tiny capsules (stable across re-renders)
  const [tinyCapsules] = useState(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      result.push({
        id: i,
        angle: ((Math.PI * 2) / 12) * i + Math.random() * 0.5,
        distance: 25 + Math.random() * 35,
        color: CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)]!,
        size: 14 + Math.random() * 10,
      });
    }
    return result;
  });

  // ── Bobble animation for dome + rotary lights ──
  useEffect(() => {
    if (phase !== 'ready' || reducedMotion) {
      setBobbleActive(false);
      return;
    }
    setBobbleActive(true);
  }, [phase, reducedMotion]);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    setMachineOpacity(0);

    // Confetti burst (tracked via timestamp for canvas)
    setConfettiStartTime(performance.now());

    // Rarity label pop-in
    schedule(() => {
      setRarityOpacity(1);
      setRarityScale(1);
    }, 300);
  }, [schedule]);

  // Open capsule → reveal card
  const openCapsule = useCallback(() => {
    if (phase !== 'waiting') return;
    setPhase('opening');
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Crack lines appear then fade
    setCrackOpacity(1);
    schedule(() => setCrackOpacity(0), 250);

    // Shell explodes outward
    setShellScale(1.3);
    setShellOpacity(0);

    // Card scales in after 200ms delay
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
    }, 200);
    schedule(enterRevealed, 450);
  }, [phase, enableHaptics, enterRevealed, schedule]);

  const enterWaiting = useCallback(() => {
    setPhase('waiting');
  }, []);

  // Spin dial → drop capsule
  const spinDial = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('spinning');
    if (enableHaptics) void triggerHaptic('medium', true);

    // Coin insert animation
    setCoinOpacity(1);
    setCoinSlideY(10);
    schedule(() => setCoinOpacity(0), 400);

    // Dial rotation
    setDialRotation(360);

    // After dial spin, drop capsule
    schedule(() => {
      setPhase('dropping');
      setCapsuleOpacity(1);
      setCapsuleY(200);
      setCapsuleRotate(540);
    }, 600);

    // Capsule lands → waiting
    schedule(enterWaiting, 1400);
  }, [phase, enableHaptics, enterWaiting, schedule]);

  // ── Reduced motion ──
  useEffect(() => {
    if (reducedMotion) {
      setCardScale(1);
      setCardOpacity(1);
      setShellOpacity(0);
      setMachineOpacity(0);
      setPhase('revealed');
      fireComplete();
    }
  }, [reducedMotion, fireComplete]);

  // ── Auto-timeout for ready and waiting phases ──
  const readyWarning = useAutoTimeout(phase === 'ready' && !reducedMotion, spinDial);
  const waitingWarning = useAutoTimeout(phase === 'waiting' && !reducedMotion, openCapsule);

  // ── Computed styles (CSS transitions applied via transitionProperty/Duration in StyleSheet) ──
  const bobbleStyle = bobbleActive
    ? ({
        animationName: 'gachaBobble',
        animationDuration: '1.2s',
        animationIterationCount: 'infinite' as const,
        animationTimingFunction: 'ease-in-out',
      } as unknown as ViewStyle)
    : undefined;

  const dialStyle = {
    transform: [{ rotate: `${dialRotation}deg` }],
  };

  const capsuleStyle = {
    opacity: capsuleOpacity * shellOpacity,
    transform: [{ translateY: capsuleY }, { scale: shellScale }, { rotate: `${capsuleRotate}deg` }],
  };

  const machineOpacityStyle = {
    opacity: machineOpacity,
  };

  const cardStyle = {
    opacity: cardOpacity,
    transform: [{ scale: cardScale }],
  };

  const rarityStyle = {
    opacity: rarityOpacity,
    transform: [{ scale: rarityScale }],
  };

  const coinStyle = {
    opacity: coinOpacity,
    transform: [{ translateY: coinSlideY }],
  };

  const crackStyle = {
    opacity: crackOpacity,
  };

  // ── Render ──
  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <LinearGradient
        colors={[...GACHA_COLORS.backgroundGradient]}
        style={StyleSheet.absoluteFill}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Canvas scene layer: rotary lights + confetti */}
      {!reducedMotion && (
        <GachaMachineCanvas
          dom={{
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: screenHeight,
            },
          }}
          width={screenWidth}
          height={screenHeight}
          rotaryLights={rotaryLights}
          confettiStars={CONFETTI_STARS}
          phase={phase === 'revealed' ? 'revealed' : 'active'}
          confettiStartTime={confettiStartTime}
          confettiDuration={1000}
        />
      )}

      {/* Machine - fades out on reveal */}
      <View
        style={[
          styles.machine,
          machineOpacityStyle,
          phase === 'revealed' ? styles.pointerEventsNone : styles.pointerEventsAuto,
        ]}
      >
        {/* Dome */}
        <View style={[styles.dome, bobbleStyle]}>
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
        </View>

        {/* Body */}
        <View style={styles.body}>
          <LinearGradient colors={[...GACHA_COLORS.bodyGradient]} style={StyleSheet.absoluteFill} />
          <View style={styles.coinSlot}>
            <View style={styles.coinSlotInner} />
            {/* Animated coin insert */}
            <View style={[styles.coin, coinStyle]}>
              <Text style={styles.coinSymbol}>¥</Text>
            </View>
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
          <View style={[styles.dial, dialStyle]}>
            <View style={styles.dialCenter} />
            <View style={styles.dialArm} />
            <View style={styles.dialKnob} />
          </View>
        </Pressable>

        {/* Base */}
        <View style={styles.base}>
          <LinearGradient colors={[...GACHA_COLORS.baseGradient]} style={StyleSheet.absoluteFill} />
        </View>
      </View>

      {/* Hints */}
      <HintWithWarning
        hintText={
          phase === 'ready'
            ? '🎯 点击旋钮开始'
            : phase === 'spinning' || phase === 'dropping'
              ? '🎰 扭蛋掉落中'
              : phase === 'waiting'
                ? '✨ 点击扭蛋打开'
                : null
        }
        showWarning={readyWarning || waitingWarning}
      />

      {/* Falling capsule */}
      {(phase === 'dropping' || phase === 'waiting' || phase === 'opening') && (
        <View style={[styles.capsule, capsuleStyle]}>
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
            <View style={[styles.crackOverlay, crackStyle]}>
              <Text style={styles.crackLine}>╲</Text>
              <Text style={styles.crackLine}>╱</Text>
              <Text style={styles.crackLine}>│</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Revealed card */}
      {(phase === 'opening' || phase === 'revealed') && (
        <View style={[styles.cardWrapper, cardStyle]}>
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
        </View>
      )}

      {/* Rarity label — pops in after reveal */}
      {phase === 'revealed' && (
        <View style={[styles.rarityContainer, { top: insets.top + 60 }, rarityStyle]}>
          <Text
            style={[styles.rarityText, { color: RARITY_LABEL[role.alignment]?.color ?? '#66bbff' }]}
          >
            {RARITY_LABEL[role.alignment]?.tier ?? 'SR'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' as const },
  pointerEventsAuto: { pointerEvents: 'auto' as const },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
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
    pointerEvents: 'none',
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
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  },
  rarityText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
    ...crossPlatformTextShadow('#00000066', 0, 2, 6),
  },
});

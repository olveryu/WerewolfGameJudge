/**
 * SealBreak - 封印解除揭示动画（Canvas 2D + Reanimated 4）
 *
 * 视觉设计：中央深红蜡封圆盘 + 外圈旋转符文魔法阵 + 内聚能量粒子。
 * 交互：长按封印中心灌注能量，环形进度从 0→100%，裂纹随进度扩展，
 * 松手进度缓慢回退。满能后白光爆闪 → 碎片四散 → 角色卡放大显示。
 *
 * Canvas 2D DOM 组件负责全部视觉渲染 + 蓄力逻辑。
 * Reanimated 负责：卡牌揭示 + 闪光。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
import { colors, crossPlatformTextShadow } from '@/theme';

import SealBreakCanvas from './SealBreakCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0810', '#100c1a', '#0a0810'] as const;
const PROGRESS_RING_COLOR = '#FFD700';
const CHARGE_GLOW_COLOR = 'rgba(255, 200, 50, 0.4)';
const SB = CONFIG.sealBreak;

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'charging' | 'shatter' | 'revealed';

// ─── Main component ─────────────────────────────────────────────────────
export const SealBreak: FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'seal-break',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const [phase, setPhase] = useState<Phase>('appear');
  const [chargePercent, setChargePercent] = useState(0);
  const { fireComplete } = useRevealLifecycle({ onComplete });
  const shatterTriggeredRef = useRef(false);
  const isPressedRef = useRef(false);
  const [isPressed, setIsPressed] = useState(false);

  // ── Shared values ──
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const chargeGlowOpacity = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;
    setPhase('shatter');
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 400 }),
    );

    // Fade canvas
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));

    // Card reveal
    cardScale.value = withDelay(
      300,
      withTiming(
        1,
        {
          duration: SB.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(enterRevealed);
        },
      ),
    );
    cardOpacity.value = withDelay(300, withTiming(1, { duration: SB.cardRevealDuration }));
  }, [enableHaptics, flashOpacity, canvasOpacity, cardScale, cardOpacity, enterRevealed]);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Brief appear phase then idle
    const timer = setTimeout(() => setPhase('idle'), SB.sealAppearDuration);
    return () => clearTimeout(timer);
  }, [reducedMotion, cardScale, cardOpacity, canvasOpacity]);

  // ── Auto-shatter timeout ──
  const autoShatter = useCallback(() => {
    if (!shatterTriggeredRef.current) {
      triggerShatter();
    }
  }, [triggerShatter]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' || phase === 'charging', autoShatter);

  // ── Press handlers ──
  const handlePressIn = useCallback(() => {
    if (phase !== 'idle' && phase !== 'charging') return;
    isPressedRef.current = true;
    setIsPressed(true);
    if (phase === 'idle') setPhase('charging');
  }, [phase]);

  const handlePressOut = useCallback(() => {
    isPressedRef.current = false;
    setIsPressed(false);
  }, []);

  // ── Canvas callbacks ──
  const handleCanvasShatter = useCallback(() => {
    triggerShatter();
  }, [triggerShatter]);

  const handleChargeUpdate = useCallback(
    (percent: number) => {
      setChargePercent(percent);
      chargeGlowOpacity.value = (percent / 100) * 0.8;
    },
    [chargeGlowOpacity],
  );

  // ── Animated styles ──
  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const chargeGlowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlowOpacity.value,
  }));

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Pressable for long-press interaction */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={`${testIDPrefix}-press-area`}
      >
        {/* Canvas layer */}
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <SealBreakCanvas
            dom={{ style: { flex: 1 } }}
            width={screenWidth}
            height={screenHeight}
            phase={phase === 'revealed' ? 'hidden' : phase}
            isPressed={isPressed}
            sealRadiusRatio={SB.sealRadiusRatio}
            chargeDuration={SB.chargeDuration}
            decayRate={SB.decayRate}
            shatterDuration={SB.shatterDuration}
            onShatter={handleCanvasShatter}
            onChargeUpdate={handleChargeUpdate}
          />
        </Animated.View>

        {/* Charge glow overlay */}
        <Animated.View style={[styles.chargeGlow, chargeGlowStyle]} />

        {/* Flash overlay */}
        <Animated.View style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]} />
      </Pressable>

      {/* Charge percentage */}
      {phase === 'charging' && (
        <View style={styles.percentContainer}>
          <Text style={styles.percentText}>{chargePercent}%</Text>
        </View>
      )}

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '🔮 封印凝聚中…'
            : phase === 'idle'
              ? '🔮 长按或连续点击封印蓄力'
              : phase === 'charging'
                ? '🔮 持续按住或点击…能量灌注中…'
                : phase === 'shatter'
                  ? '✨ 封印已破！'
                  : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'shatter' || phase === 'revealed') && (
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
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  chargeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CHARGE_GLOW_COLOR,
    pointerEvents: 'none',
  },
  percentContainer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    pointerEvents: 'none',
  },
  percentText: {
    fontSize: 28,
    fontWeight: '800',
    color: PROGRESS_RING_COLOR,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 6),
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

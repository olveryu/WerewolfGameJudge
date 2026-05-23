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
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [chargeGlowOpacity, setChargeGlowOpacity] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;
    setPhase('shatter');
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash sequence
    setFlashOpacity(0.7);
    schedule(() => setFlashOpacity(0), 100);

    // Fade canvas
    schedule(() => setCanvasOpacity(0), 200);

    // Card reveal
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
      schedule(enterRevealed, SB.cardRevealDuration);
    }, 300);
  }, [enableHaptics, enterRevealed, schedule]);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      setCardScale(1);
      setCardOpacity(1);
      setCanvasOpacity(0);
      setPhase('revealed');
      return;
    }

    // Brief appear phase then idle
    const timer = setTimeout(() => setPhase('idle'), SB.sealAppearDuration);
    const timers = timersRef.current;
    return () => {
      clearTimeout(timer);
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

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

  const handleChargeUpdate = useCallback((percent: number) => {
    setChargePercent(percent);
    setChargeGlowOpacity((percent / 100) * 0.8);
  }, []);

  // ── Computed styles with CSS transitions ──
  const canvasContainerStyle = {
    opacity: canvasOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease-out',
  } as never;

  const cardStyle = {
    transform: [{ scale: cardScale }],
    opacity: cardOpacity,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${SB.cardRevealDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

  const flashStyle = {
    opacity: flashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '100ms',
    transitionTimingFunction: 'ease-out',
  } as never;

  const chargeGlowStyle = {
    opacity: chargeGlowOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '100ms',
  } as never;

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
        <View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
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
        </View>

        {/* Charge glow overlay */}
        <View style={[styles.chargeGlow, chargeGlowStyle]} />

        {/* Flash overlay */}
        <View style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]} />
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

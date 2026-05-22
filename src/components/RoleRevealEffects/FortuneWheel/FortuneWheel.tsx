/**
 * FortuneWheel - 命运转盘揭示动画（Canvas 2D + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：宝石色彩扇形 + 金色外圈转盘，每格显示角色名，顶部固定指针。
 * 交互：Pan 拖拽/flick 旋转转盘，减速后停在玩家真实角色。
 * 停止后：闪光 → 转盘淡出 → 卡牌放大揭示。
 *
 * 转盘视觉与交互全部由 FortuneWheelCanvas DOM 组件处理。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
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
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { colors } from '@/theme';

import FortuneWheelCanvas from './FortuneWheelCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0a1e', '#12122a', '#0a0a1e'] as const;
const HINT_ALIGNED_COLOR = '#4ECDC4';
const FW = CONFIG.fortuneWheel;

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

  // Prepare segments from allRoles (deduplicated, min 6)
  const segments = useMemo(() => {
    const source = allRoles ?? [role];
    const unique = [...new Set(source.map((r) => r.id))];
    const roles = unique.map((id) => source.find((r) => r.id === id)!);
    if (roles.length < 6) {
      const padded = [...roles];
      while (padded.length < 6) {
        padded.push(roles[padded.length % roles.length]!);
      }
      return padded;
    }
    return roles;
  }, [allRoles, role]);

  const targetIndex = useMemo(() => {
    const idx = segments.findIndex((s) => s.id === role.id);
    return idx >= 0 ? idx : 0;
  }, [segments, role.id]);

  const [phase, setPhase] = useState<Phase>('appear');
  const [canvasHidden, setCanvasHidden] = useState(false);
  const { fireComplete } = useRevealLifecycle({ onComplete });

  const cardScaleVal = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerCardReveal = useCallback(() => {
    if (enableHaptics) void triggerHaptic('heavy', true);

    flashOpacity.value = withSequence(
      withTiming(0.6, { duration: 100 }),
      withTiming(0, { duration: 400 }),
    );
    // Hide canvas after flash peaks (canvas disappears behind the flash)
    setTimeout(() => setCanvasHidden(true), 200);
    cardScaleVal.value = withDelay(
      300,
      withTiming(
        1,
        { duration: FW.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(enterRevealed);
        },
      ),
    );
    cardOpacity.value = withDelay(300, withTiming(1, { duration: FW.cardRevealDuration }));
  }, [cardScaleVal, cardOpacity, flashOpacity, enableHaptics, enterRevealed]);

  // Init
  useEffect(() => {
    if (reducedMotion) {
      cardScaleVal.value = 1;
      cardOpacity.value = 1;
      setCanvasHidden(true);
      setPhase('revealed');
    }
  }, [reducedMotion, cardScaleVal, cardOpacity]);

  // When canvas reports spin complete → trigger card reveal after short pause
  const handleSpinComplete = useCallback(() => {
    setPhase('stopped');
    setTimeout(() => triggerCardReveal(), 400);
  }, [triggerCardReveal]);

  const handleSpinStart = useCallback(() => {
    setPhase('spinning');
    if (enableHaptics) void triggerHaptic('medium', true);
  }, [enableHaptics]);

  // Canvas appear animation done → transition to idle
  const handleReady = useCallback(() => {
    setPhase('idle');
  }, []);

  // Auto-spin timeout
  const autoSpin = useCallback(() => {
    // Canvas handles the auto-spin internally when phase is set
    setPhase('spinning');
  }, []);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoSpin);

  // ─── Animated styles ──────────────────────────────────────────────────
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScaleVal.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyleAnim = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // Segments for canvas (serializable)
  const canvasSegments = useMemo(
    () => segments.map((s) => ({ id: s.id, name: s.name })),
    [segments],
  );

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

      {/* Pedestal base */}
      <View style={styles.pedestal}>
        <View style={styles.pedestalTop} />
        <View style={styles.pedestalBody} />
      </View>

      {/* Canvas wheel + interaction */}
      {!canvasHidden && (
        <View style={StyleSheet.absoluteFill}>
          <FortuneWheelCanvas
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
            segments={canvasSegments}
            targetIndex={targetIndex}
            phase={phase === 'revealed' ? 'hidden' : phase}
            onSpinStart={handleSpinStart}
            onSpinComplete={handleSpinComplete}
            onReady={handleReady}
          />
        </View>
      )}

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

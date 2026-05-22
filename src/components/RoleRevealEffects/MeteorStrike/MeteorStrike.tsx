import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { colors } from '@/theme';

import MeteorOverlayCanvas from './MeteorOverlayCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#020010', '#0a0025', '#050015'] as const;

const MS = CONFIG.meteorStrike;

const COLORS = {
  impactOrange: 'rgba(255, 200, 100, 0.9)',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'impact' | 'revealed';

// ─── Main component ─────────────────────────────────────────────────────

export const MeteorStrike: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'meteor-strike',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenW, height: screenH } = useWindowDimensions();

  const common = CONFIG.common;
  const cardWidth = Math.min(screenW * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const [phase, setPhase] = useState<Phase>('atmosphere');
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: MS.revealHoldDuration,
  });

  // ── Card reveal animation values ──
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const caughtRef = useRef(false);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerCardReveal = useCallback(() => {
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.8, { duration: 80 }),
      withTiming(0, { duration: 400 }),
    );

    // Fade out canvas overlay
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));

    // Card reveal
    cardScale.value = withDelay(
      MS.cardRevealDelay,
      withTiming(
        1,
        {
          duration: MS.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(enterRevealed);
        },
      ),
    );
    cardOpacity.value = withDelay(
      MS.cardRevealDelay,
      withTiming(1, { duration: MS.cardRevealDuration }),
    );
  }, [enableHaptics, flashOpacity, canvasOpacity, cardScale, cardOpacity, enterRevealed]);

  // ── Meteor caught handler (called from DOM component) ──
  const handleMeteorCaught = useCallback(() => {
    if (caughtRef.current) return;
    caughtRef.current = true;
    setPhase('impact');

    // Wait for impact animation to play out, then reveal card
    setTimeout(triggerCardReveal, MS.impactAnimDuration);
  }, [triggerCardReveal]);

  // ── Init animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Atmosphere phase → idle
    const atmosphereTimer = setTimeout(() => {
      setPhase('idle');
    }, MS.atmosphereDuration);

    return () => clearTimeout(atmosphereTimer);
  }, [reducedMotion, cardScale, cardOpacity, canvasOpacity]);

  // ── Auto-timeout ──
  const autoTrigger = useCallback(() => {
    if (!caughtRef.current) {
      handleMeteorCaught();
    }
  }, [handleMeteorCaught]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoTrigger);

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

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Deep-space background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Canvas overlay: stars + meteor + trail + impact effects */}
      <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
        <MeteorOverlayCanvas
          dom={{ style: { flex: 1 } }}
          width={screenW}
          height={screenH}
          phase={phase === 'revealed' ? 'hidden' : phase}
          onMeteorCaught={handleMeteorCaught}
        />
      </Animated.View>

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flash, flashStyle, { backgroundColor: COLORS.impactOrange }]}
      />

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'atmosphere'
            ? '🌠 星空凝望中…'
            : phase === 'idle'
              ? '🌠 点击划过的流星！'
              : phase === 'impact'
                ? '💥 陨石坠落！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'impact' || phase === 'revealed') && (
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

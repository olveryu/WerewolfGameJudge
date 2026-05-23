import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

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
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const caughtRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const triggerCardReveal = useCallback(() => {
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash sequence: 0 → 0.8 → 0
    setFlashOpacity(0.8);
    schedule(() => setFlashOpacity(0), 80);

    // Fade out canvas overlay
    schedule(() => setCanvasOpacity(0), 200);

    // Card reveal
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
      schedule(enterRevealed, MS.cardRevealDuration);
    }, MS.cardRevealDelay);
  }, [enableHaptics, enterRevealed, schedule]);

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
      setCardScale(1);
      setCardOpacity(1);
      setCanvasOpacity(0);
      setPhase('revealed');
      return;
    }

    // Atmosphere phase → idle
    const atmosphereTimer = setTimeout(() => {
      setPhase('idle');
    }, MS.atmosphereDuration);

    const timers = timersRef.current;
    return () => {
      clearTimeout(atmosphereTimer);
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  // ── Auto-timeout ──
  const autoTrigger = useCallback(() => {
    if (!caughtRef.current) {
      handleMeteorCaught();
    }
  }, [handleMeteorCaught]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoTrigger);

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
    transitionDuration: `${MS.cardRevealDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

  const flashStyle = {
    opacity: flashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease-out',
  } as never;

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
      <View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
        <MeteorOverlayCanvas
          dom={{ style: { flex: 1 } }}
          width={screenW}
          height={screenH}
          phase={phase === 'revealed' ? 'hidden' : phase}
          onMeteorCaught={handleMeteorCaught}
        />
      </View>

      {/* Flash overlay */}
      <View style={[styles.flash, flashStyle, { backgroundColor: COLORS.impactOrange }]} />

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

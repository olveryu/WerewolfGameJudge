/**
 * RoleRevealAnimator - Unified entry point for role reveal animations.
 *
 * Dispatches to the corresponding reveal animation component based on effectType (flip/scratch/tarot/gacha/roulette).
 * All effects display the full RoleCardContent style directly within the animation.
 * Renders the animation and dispatches to the appropriate effect component by effectType. No service imports, no business logic.
 */
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { crossPlatformTextShadow } from '@/theme';
import { log } from '@/utils/logger';

import { CardPick } from './effects/CardPick';
import { ChainShatter } from './effects/ChainShatter';
import { EnhancedRoulette } from './effects/EnhancedRoulette';
import { FateDecree } from './effects/FateDecree';
import { FilmRewind } from './effects/FilmRewind';
import { FortuneWheel } from './effects/FortuneWheel';
import { GachaMachine } from './effects/GachaMachine';
import { MeteorStrike } from './effects/MeteorStrike';
import { MythicCollectionReveal } from './effects/MythicCollectionReveal';
import { RoleHunt } from './effects/RoleHunt';
import { ScratchReveal } from './effects/ScratchReveal';
import { SealBreak } from './effects/SealBreak';
import { TarotDraw } from './effects/TarotDraw';
import { VortexCollapse } from './effects/VortexCollapse';
import type { RevealEffectType, RoleRevealAnimatorProps } from './types';

/** Effect types that play automatically (no user interaction required). */
const AUTO_EFFECTS: ReadonlySet<RevealEffectType> = new Set([
  'filmRewind',
  'fateDecree',
  'fateReweave',
  'oceanPearl',
  'unfoldLandscape',
]);

/** Selects the prompt title based on effect type: interactive types guide the user; auto types announce the upcoming reveal. */
function getTitleForEffect(effectType: RevealEffectType): string {
  return AUTO_EFFECTS.has(effectType) ? '🎭 你的身份即将揭晓' : '🎭 完成下方操作，揭晓你的身份';
}

export const RoleRevealAnimator: React.FC<RoleRevealAnimatorProps> = ({
  visible,
  effectType,
  role,
  allRoles,
  remainingCards,
  onComplete,
  reducedMotion: reducedMotionProp,
  enableHaptics = true,
  testIDPrefix = 'role-reveal',
}) => {
  const insets = useSafeAreaInsets();
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const titleText = useMemo(() => getTitleForEffect(effectType), [effectType]);

  // Check system reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReducedMotion)
      .catch((e) => {
        log.warn('Failed to query reduced motion preference', e);
        setSystemReducedMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReducedMotion,
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // Use prop if provided, otherwise use system preference
  const reducedMotion = reducedMotionProp ?? systemReducedMotion;

  if (!visible) return null;

  // Prepare allRoles for roulette effect
  const rouletteRoles = allRoles ? [...allRoles] : [role];

  // Common props for all effects
  const commonProps = {
    role,
    onComplete,
    reducedMotion,
    enableHaptics,
    testIDPrefix,
  };

  // Render the appropriate effect via exhaustive registry.
  // Using Record<RevealEffectType, ...> ensures compile-time failure if a new
  // effect type is added to the union but not registered here. No silent default.
  const renderEffect = () => {
    const registry: Record<RevealEffectType, () => React.ReactNode> = {
      fateReweave: () => <MythicCollectionReveal {...commonProps} collection="astral" />,
      oceanPearl: () => <MythicCollectionReveal {...commonProps} collection="ocean" />,
      unfoldLandscape: () => <MythicCollectionReveal {...commonProps} collection="ink" />,
      fateDecree: () => <FateDecree {...commonProps} />,
      roulette: () => <EnhancedRoulette {...commonProps} allRoles={rouletteRoles} />,
      roleHunt: () => <RoleHunt {...commonProps} allRoles={rouletteRoles} />,
      scratch: () => <ScratchReveal {...commonProps} />,
      tarot: () => <TarotDraw {...commonProps} />,
      gachaMachine: () => <GachaMachine {...commonProps} />,
      cardPick: () => <CardPick {...commonProps} remainingCards={remainingCards} />,
      sealBreak: () => <SealBreak {...commonProps} />,
      chainShatter: () => <ChainShatter {...commonProps} />,
      fortuneWheel: () => <FortuneWheel {...commonProps} allRoles={rouletteRoles} />,
      meteorStrike: () => <MeteorStrike {...commonProps} />,
      filmRewind: () => <FilmRewind {...commonProps} />,
      vortexCollapse: () => <VortexCollapse {...commonProps} />,
    };
    const render = registry[effectType];
    if (!render) {
      throw new Error(`[FAIL-FAST] Unknown reveal effect type: ${effectType}`);
    }
    return render();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      testID={`${testIDPrefix}-modal`}
    >
      <View style={styles.container}>
        {/* Unified title — tells user this is identity reveal */}
        <View style={[styles.titleContainer, { top: insets.top + 8 }]}>
          <Text style={styles.titleText}>{titleText}</Text>
        </View>
        {renderEffect()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible', // Allow child effects to render outside bounds
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  titleContainer: {
    position: 'absolute',
    top: 50, // overridden inline with safe area insets
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 24,
    pointerEvents: 'none',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
    letterSpacing: 2,
  },
});

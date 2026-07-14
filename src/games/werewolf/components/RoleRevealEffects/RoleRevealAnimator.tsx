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

import { CardPick } from './CardPick';
import { ChainShatter } from './ChainShatter';
import { EnhancedRoulette } from './EnhancedRoulette';
import { FilmRewind } from './FilmRewind';
import { FortuneWheel } from './FortuneWheel';
import { GachaMachine } from './GachaMachine';
import { MeteorStrike } from './MeteorStrike';
import { RoleHunt } from './RoleHunt';
import { ScratchReveal } from './ScratchReveal';
import { SealBreak } from './SealBreak';
import { TarotDraw } from './TarotDraw';
import type { RevealEffectType, RoleData, RoleRevealAnimatorProps } from './types';
import { VortexCollapse } from './VortexCollapse';

/** Effect types that play automatically (no user interaction required). */
const AUTO_EFFECTS: ReadonlySet<RevealEffectType> = new Set(['filmRewind']);

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
  const rouletteRoles = allRoles ?? [role];

  // Common props for all effects
  const commonProps = {
    role,
    onComplete,
    reducedMotion,
    enableHaptics,
    testIDPrefix,
  };

  // Render the appropriate effect
  const renderEffect = () => {
    switch (effectType) {
      case 'roulette':
        return <EnhancedRoulette {...commonProps} allRoles={rouletteRoles} />;
      case 'roleHunt':
        return <RoleHunt {...commonProps} allRoles={rouletteRoles} />;
      case 'scratch':
        return <ScratchReveal {...commonProps} />;
      case 'tarot':
        return <TarotDraw {...commonProps} />;
      case 'gachaMachine':
        return <GachaMachine {...commonProps} />;
      case 'cardPick':
        return <CardPick {...commonProps} remainingCards={remainingCards} />;
      case 'sealBreak':
        return <SealBreak {...commonProps} />;
      case 'chainShatter':
        return <ChainShatter {...commonProps} />;
      case 'fortuneWheel':
        return <FortuneWheel {...commonProps} allRoles={rouletteRoles} />;
      case 'meteorStrike':
        return <MeteorStrike {...commonProps} />;
      case 'filmRewind':
        return <FilmRewind {...commonProps} />;
      case 'vortexCollapse':
        return <VortexCollapse {...commonProps} />;
      default:
        // Default to roleHunt if unknown effect type
        return <RoleHunt {...commonProps} allRoles={rouletteRoles} />;
    }
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

/**
 * Helper to create RoleData from role ID and spec
 */
export function createRoleData(
  id: string,
  name: string,
  alignment: 'wolf' | 'god' | 'villager' | 'third',
  avatar?: string,
  description?: string,
): RoleData {
  return { id, name, alignment, avatar, description };
}

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

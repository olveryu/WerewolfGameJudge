/**
 * RoleRevealAnimator - Unified entry point for all reveal effects
 *
 * Usage:
 * ```tsx
 * <RoleRevealAnimator
 *   visible={showReveal}
 *   effectType="flip"
 *   role={{ id: 'wolf', name: '狼人', alignment: 'wolf', avatar: '🐺' }}
 *   onComplete={() => setShowReveal(false)}
 * />
 * ```
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, AccessibilityInfo } from 'react-native';
import type { RoleRevealAnimatorProps, RevealEffectType, RoleData } from './types';
import { EnhancedRoulette } from './EnhancedRoulette';
import { FlipReveal } from './FlipReveal';
import { ScratchReveal } from './ScratchReveal';
import { FragmentAssemble } from './FragmentAssemble';
import { FogReveal } from './FogReveal';
import { useColors } from '../../theme';

export const RoleRevealAnimator: React.FC<RoleRevealAnimatorProps> = ({
  visible,
  effectType,
  role,
  allRoles,
  onComplete,
  reducedMotion: reducedMotionProp,
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'role-reveal',
}) => {
  const colors = useColors();
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  // Check system reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReducedMotion)
      .catch(() => setSystemReducedMotion(false));

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReducedMotion
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
    enableSound,
    enableHaptics,
    testIDPrefix,
  };

  // Render the appropriate effect
  const renderEffect = () => {
    switch (effectType) {
      case 'roulette':
        return <EnhancedRoulette {...commonProps} allRoles={rouletteRoles} />;
      case 'flip':
        return <FlipReveal {...commonProps} />;
      case 'scratch':
        return <ScratchReveal {...commonProps} />;
      case 'fragment':
        return <FragmentAssemble {...commonProps} />;
      case 'fog':
        return <FogReveal {...commonProps} />;
      default:
        // Default to flip if unknown effect type
        return <FlipReveal {...commonProps} />;
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
      <View style={[styles.container, { backgroundColor: colors.overlay }]}>
        {renderEffect()}
      </View>
    </Modal>
  );
};

/**
 * Hook to get a random effect type
 */
export function useRandomEffectType(): RevealEffectType {
  const effects: RevealEffectType[] = ['roulette', 'flip', 'scratch', 'fragment', 'fog'];
  const [effectType] = useState<RevealEffectType>(
    () => effects[Math.floor(Math.random() * effects.length)]
  );
  return effectType;
}

/**
 * Helper to create RoleData from role ID and spec
 */
export function createRoleData(
  id: string,
  name: string,
  alignment: 'wolf' | 'god' | 'villager',
  avatar?: string,
  description?: string
): RoleData {
  return { id, name, alignment, avatar, description };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

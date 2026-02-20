/**
 * RoleRevealAnimator - 角色揭示动画统一入口
 *
 * 根据 effectType 分发到对应的揭示动画组件（flip/scratch/tarot/gacha/roulette）。
 * 所有效果在动画中直接显示完整 RoleCardContent 样式。
 * 渲染动画并按 effectType 分发到对应效果组件。不 import service，不含业务逻辑。
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';
import { log } from '@/utils/logger';

import { CardPick } from './CardPick';
import { EnhancedRoulette } from './EnhancedRoulette';
import { FlipReveal } from './FlipReveal';
import { GachaMachine } from './GachaMachine';
import { ScratchReveal } from './ScratchReveal';
import { TarotDraw } from './TarotDraw';
import type { RoleData, RoleRevealAnimatorProps } from './types';

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
  const colors = useColors();
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  // Check system reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReducedMotion)
      .catch((e) => {
        log.warn('Failed to query reduced motion preference:', e);
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
      case 'flip':
        return <FlipReveal {...commonProps} />;
      case 'scratch':
        return <ScratchReveal {...commonProps} />;
      case 'tarot':
        return <TarotDraw {...commonProps} />;
      case 'gachaMachine':
        return <GachaMachine {...commonProps} />;
      case 'cardPick':
        return <CardPick {...commonProps} remainingCards={remainingCards} />;
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
      <View style={[styles.container, { backgroundColor: colors.overlay }]}>{renderEffect()}</View>
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
  },
});

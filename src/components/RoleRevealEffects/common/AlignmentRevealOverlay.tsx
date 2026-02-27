/**
 * AlignmentRevealOverlay - 阵营特效统一分发器
 *
 * 在翻牌 revealed 阶段根据角色阵营渲染差异化视觉效果。
 * 每个阵营都有专属特效 + 持续呼吸边框 + ScreenFlash。
 * `onComplete` 在 BreathingBorder 的 effectDisplayDuration 后触发。
 * Reduced motion 时不渲染任何特效，通过 timer 触发 onComplete。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { BreathingBorder } from '@/components/RoleRevealEffects/common/effects/BreathingBorder';
import { GodRevealEffect } from '@/components/RoleRevealEffects/common/effects/GodRevealEffect';
import { ScreenFlash } from '@/components/RoleRevealEffects/common/effects/ScreenFlash';
import { ThirdRevealEffect } from '@/components/RoleRevealEffects/common/effects/ThirdRevealEffect';
import { VillagerRevealEffect } from '@/components/RoleRevealEffects/common/effects/VillagerRevealEffect';
import { WolfRevealEffect } from '@/components/RoleRevealEffects/common/effects/WolfRevealEffect';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { AlignmentTheme, RoleAlignment } from '@/components/RoleRevealEffects/types';

const { alignmentEffects: AE } = CONFIG;

interface AlignmentRevealOverlayProps {
  /** Role alignment (faction) */
  alignment: RoleAlignment;
  /** Derived theme colors for this alignment */
  theme: AlignmentTheme;
  /** Card content width */
  cardWidth: number;
  /** Card content height */
  cardHeight: number;
  /** Whether to animate (false = reduced motion) */
  animate: boolean;
  /** Callback when initial flash completes (game state progression) */
  onComplete?: () => void;
}

export const AlignmentRevealOverlay: React.FC<AlignmentRevealOverlayProps> = ({
  alignment,
  theme,
  cardWidth,
  cardHeight,
  animate,
  onComplete,
}) => {
  // Reduced motion: no visual overlay, fire onComplete via timer
  useEffect(() => {
    if (animate) return;
    const timer = setTimeout(() => onComplete?.(), 300);
    return () => clearTimeout(timer);
  }, [animate, onComplete]);

  if (!animate) {
    return null;
  }

  // Full effect: alignment-specific visual + breathing border + screen flash
  const effectProps = {
    cardWidth,
    cardHeight,
    animate,
    primaryColor: theme.primaryColor,
    glowColor: theme.glowColor,
    particleColor: theme.particleColor,
  };

  const breathingDuration = AE.breathingDuration[alignment] ?? 2500;
  const screenFlashOpacity = AE.screenFlashOpacity[alignment] ?? 0.45;
  const screenFlashDelay = alignment === 'wolf' ? 200 : 250;

  return (
    <View style={styles.effectContainer} pointerEvents="none">
      {/* Full-screen radial flash from card center */}
      <ScreenFlash
        color={theme.primaryColor}
        peakOpacity={screenFlashOpacity}
        duration={AE.screenFlashDuration}
        animate={animate}
        centerX={cardWidth / 2}
        centerY={cardHeight * 0.42}
        delay={screenFlashDelay}
      />

      {/* Alignment-specific visual effects */}
      {alignment === 'wolf' && <WolfRevealEffect {...effectProps} />}
      {alignment === 'god' && <GodRevealEffect {...effectProps} />}
      {alignment === 'third' && <ThirdRevealEffect {...effectProps} />}
      {alignment === 'villager' && <VillagerRevealEffect {...effectProps} />}

      {/* Enhanced breathing border */}
      <BreathingBorder
        color={theme.primaryColor}
        glowColor={theme.glowColor}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        animate={animate}
        breathingDuration={breathingDuration}
        onComplete={onComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  effectContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
});

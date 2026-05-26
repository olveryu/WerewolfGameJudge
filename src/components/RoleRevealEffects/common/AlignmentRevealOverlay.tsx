/**
 * AlignmentRevealOverlay - Unified faction effect dispatcher
 *
 * During the reveal phase, renders differentiated visual effects based on role faction.
 * Each faction has dedicated effects + continuous breathing border + ScreenFlash.
 * `onComplete` fires after BreathingBorder's effectDisplayDuration.
 * Under reduced motion, renders no effects and triggers onComplete via timer.
 *
 * Crack layer rendered inside RoleCardContent (between gradient background and role icon)
 * to ensure cracks sit behind the role image.
 * No service imports, no business logic.
 */
import type React from 'react';
import { useEffect } from 'react';
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

  return (
    <View style={styles.effectContainer}>
      {/* Full-screen radial flash — neutral color to prevent leaking alignment */}
      <ScreenFlash
        color={AE.screenFlashColor}
        peakOpacity={AE.screenFlashOpacity}
        duration={AE.screenFlashDuration}
        animate={animate}
        centerX={cardWidth / 2}
        centerY={cardHeight * 0.42}
        delay={250}
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
    pointerEvents: 'none',
  },
});

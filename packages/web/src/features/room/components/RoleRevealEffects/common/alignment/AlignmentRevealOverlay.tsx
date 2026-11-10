import { useEffect } from 'react';

import type { RevealAlignment } from '../../../../model/RevealRoleData';
import { CONFIG } from '../../config';
import type { AlignmentTheme } from '../../themes';
import type { ViewRect } from '../useAnchorRect';
import { BreathingBorder } from './BreathingBorder';
import { GodRevealEffect } from './GodRevealEffect';
import { ScreenFlash } from './ScreenFlash';
import { ThirdRevealEffect } from './ThirdRevealEffect';
import { VillagerRevealEffect } from './VillagerRevealEffect';
import { WolfRevealEffect } from './WolfRevealEffect';

const AE = CONFIG.alignmentEffects;
const NO_ANIMATION_COMPLETE_MS = 300;

interface AlignmentRevealOverlayProps {
  readonly alignment: RevealAlignment;
  readonly theme: AlignmentTheme;
  readonly rect: ViewRect;
  /** Layer order on the shared stage; the faction art sits above the card face. */
  readonly zIndex: number;
  readonly animate: boolean;
  readonly onComplete: () => void;
}

/**
 * The faction finale every reveal effect ends with: a neutral flash, the faction's own art and a
 * breathing border, then `onComplete`. Without motion it completes after a short beat.
 */
export function AlignmentRevealOverlay({
  alignment,
  theme,
  rect,
  zIndex,
  animate,
  onComplete,
}: AlignmentRevealOverlayProps) {
  useEffect(() => {
    if (animate) return;
    const timer = setTimeout(onComplete, NO_ANIMATION_COMPLETE_MS);
    return () => clearTimeout(timer);
  }, [animate, onComplete]);

  if (!animate) return null;
  const effectProps = { rect, zIndex, theme };
  return (
    <>
      <ScreenFlash
        rect={rect}
        zIndex={zIndex}
        color={AE.screenFlashColor}
        peakOpacity={AE.screenFlashOpacity}
        duration={AE.screenFlashDuration}
        centerX={rect.width / 2}
        centerY={rect.height * 0.42}
        delay={250}
      />
      {alignment === 'wolf' && <WolfRevealEffect {...effectProps} />}
      {alignment === 'god' && <GodRevealEffect {...effectProps} />}
      {alignment === 'third' && <ThirdRevealEffect {...effectProps} />}
      {alignment === 'villager' && <VillagerRevealEffect {...effectProps} />}
      <BreathingBorder
        rect={rect}
        zIndex={zIndex}
        color={theme.primaryColor}
        glowColor={theme.glowColor}
        breathingDuration={AE.breathingDuration[alignment]}
        onComplete={onComplete}
      />
    </>
  );
}

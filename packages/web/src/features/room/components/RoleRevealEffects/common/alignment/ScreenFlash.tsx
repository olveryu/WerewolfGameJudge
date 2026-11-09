import { useEffect } from 'react';

import { Easing, withDelay, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { graphicsLayer, radialGradient } from '../../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue, useViewportSize } from '../../runtime';
import type { ViewRect } from '../useAnchorRect';
import { useCanvasLayer } from '../useCanvasLayer';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const BURST_PARTICLES = Array.from({ length: SK.burstParticleCount }, (_, i) => ({
  angle: (i / SK.burstParticleCount) * Math.PI * 2 + ((i * 7) % 10) * 0.06,
  distance: 50 + ((i * 31) % 100) * 1.5,
  size: 1.5 + ((i * 13) % 20) / 10,
}));

interface ScreenFlashProps {
  readonly rect: ViewRect;
  readonly zIndex: number;
  readonly color: string;
  readonly peakOpacity: number;
  readonly duration: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly delay: number;
}

/** A radial shock wave and spark burst from the card center when the role is revealed. */
export function ScreenFlash({
  rect,
  zIndex,
  color,
  peakOpacity,
  duration,
  centerX,
  centerY,
  delay,
}: ScreenFlashProps) {
  const canvas = useCanvasLayer(zIndex, rect);
  const progress = useSharedValue(0);
  const { width: screenWidth } = useViewportSize();

  useEffect(() => {
    progress.animate(
      withDelay(
        AE.effectStartDelay + delay,
        withSequence(
          withTiming(0.15, { duration: duration * 0.15, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: duration * 0.85, easing: Easing.out(Easing.quad) }),
        ),
      ),
    );
  }, [progress, delay, duration]);

  const build: ArtBuilder = (root, own) => {
    const wave = graphicsLayer(root, { blur: SK.flashBlur });
    const waveFill = own(
      radialGradient(centerX, centerY, screenWidth, [color, `${color}80`, `${color}00`]),
    );
    const burst = graphicsLayer(root, { blur: SK.particleBlur, screen: true });
    return () => {
      const p = progress.get();
      wave.clear();
      wave.alpha =
        p < 0.15 ? (p / 0.15) * peakOpacity : Math.max(0, peakOpacity * (1 - (p - 0.15) / 0.85));
      if (p > 0) wave.circle(centerX, centerY, p * screenWidth).fill(waveFill);
      burst.clear();
      const opacity = p < 0.05 ? p / 0.05 : Math.max(0, 1 - (p - 0.05) / 0.6);
      if (opacity <= 0) return;
      for (const particle of BURST_PARTICLES) {
        const distance = particle.distance * p;
        burst
          .circle(
            centerX + Math.cos(particle.angle) * distance,
            centerY + Math.sin(particle.angle) * distance,
            particle.size * Math.max(0.3, 1 - p * 0.7),
          )
          .fill({ color, alpha: opacity });
      }
    };
  };
  useFrameArt(canvas, build);
  return null;
}

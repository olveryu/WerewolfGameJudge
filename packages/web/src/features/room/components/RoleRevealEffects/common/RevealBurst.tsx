import { useEffect } from 'react';

import { Easing, withSequence, withTiming } from '@/scene/timeline';

import { graphicsLayer } from '../pixi/kit';
import { type ArtBuilder, useFrameArt, usePixiLayer } from '../pixiLayer';
import { useSharedValue, useViewportSize } from '../runtime';

const PARTICLE_COUNT = 16;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i / PARTICLE_COUNT) * Math.PI * 2 + ((i * 7) % 10) * 0.06,
  distance: 40 + ((i * 31) % 80),
  radius: 1.5 + ((i * 13) % 20) / 10,
}));

interface RevealBurstProps {
  /** The burst plays once when this turns true. */
  readonly trigger: boolean;
  readonly zIndex: number;
  readonly color?: string;
  /** Viewport center; defaults to the screen's horizontal middle at 45% height. */
  readonly centerX?: number;
  readonly centerY?: number;
}

/** The expanding ring and spark spray every effect fires as the card face appears. */
export function RevealBurst({ trigger, ...props }: RevealBurstProps) {
  return trigger ? <Burst {...props} /> : null;
}

function Burst({ zIndex, color = '#FFD700', centerX, centerY }: Omit<RevealBurstProps, 'trigger'>) {
  const layer = usePixiLayer(zIndex);
  const { width, height } = useViewportSize();
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const cx = centerX ?? width / 2;
  const cy = centerY ?? height * 0.45;

  useEffect(() => {
    ringScale.animate(withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    ringOpacity.animate(
      withSequence(
        withTiming(0.5, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
      ),
    );
    particleProgress.animate(withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
  }, [ringScale, ringOpacity, particleProgress]);

  const build: ArtBuilder = (root) => {
    const ring = graphicsLayer(root);
    const sparks = graphicsLayer(root);
    const ringRadius = width * 0.4;
    return () => {
      const scale = ringScale.get();
      ring.clear();
      ring.alpha = ringOpacity.get();
      if (scale > 0) {
        ring
          .circle(cx, cy, (ringRadius - 1) * scale)
          .stroke({ color, width: 2 * scale, alignment: 0.5 });
      }
      const p = particleProgress.get();
      sparks.clear();
      const alpha = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.8);
      if (alpha <= 0) return;
      for (const particle of PARTICLES) {
        sparks
          .circle(
            cx + Math.cos(particle.angle) * particle.distance * p,
            cy + Math.sin(particle.angle) * particle.distance * p,
            particle.radius,
          )
          .fill({ color, alpha });
      }
    };
  };
  useFrameArt(layer, build);
  return null;
}

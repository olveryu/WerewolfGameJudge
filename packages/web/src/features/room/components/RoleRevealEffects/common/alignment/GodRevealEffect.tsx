import { useEffect } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { graphicsLayer, radialGradient } from '../../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue } from '../../runtime';
import type { AlignmentEffectProps } from './types';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const HALO_CONFIGS = [
  { startP: 0.06, durationP: 0.4 },
  { startP: 0.12, durationP: 0.48 },
  { startP: 0.18, durationP: 0.56 },
  { startP: 0.25, durationP: 0.6 },
] as const;

const GOD_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  const r4 = ((i * 37 + 53) % 100) / 100;
  const angle = ((i * 29 + 11) % 360) * (Math.PI / 180);
  const distance = 20 + r1 * 120;
  return {
    startX: Math.cos(angle) * distance * 0.3,
    startY: Math.sin(angle) * distance * 0.3,
    driftX: (r2 - 0.5) * 40,
    driftY: -20 - r3 * 60,
    size: 1 + r4 * 2.5,
    baseAlpha: 0.3 + ((i * 67 + 23) % 70) / 100,
    twinklePhase: ((i * 83 + 11) % 628) / 100,
  };
});

const TWINKLE_CYCLE_MS = 1047;
const PARTICLE_LIFETIME_MS = 5500;
const PARTICLE_START_DELAY_MS = 400;

function pillarOpacity(p: number): number {
  if (p < 0.05) return p / 0.05;
  if (p < 0.3) return 1;
  return Math.max(0.15, 1 - (p - 0.3) / 0.7);
}

/** God reveal: holy glow, a light pillar, a cross flash, expanding halos and gold motes. */
export function GodRevealEffect({ rect, zIndex, theme }: AlignmentEffectProps) {
  const progress = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);

  useEffect(() => {
    const outQuad = Easing.out(Easing.quad);
    progress.animate(
      withDelay(AE.effectStartDelay, withTiming(1, { duration: 2500, easing: outQuad })),
    );
    glowIntensity.animate(
      withDelay(
        AE.effectStartDelay,
        withSequence(
          withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
          withTiming(0.6, { duration: 625, easing: outQuad }),
          withTiming(0.35, { duration: 1500, easing: outQuad }),
        ),
      ),
    );
    const particleDelay = AE.effectStartDelay + PARTICLE_START_DELAY_MS;
    particleProgress.animate(
      withDelay(
        particleDelay,
        withTiming(1, { duration: PARTICLE_LIFETIME_MS, easing: Easing.linear }),
      ),
    );
    twinkleCycle.animate(
      withDelay(
        particleDelay,
        withRepeat(withTiming(Math.PI * 2, { duration: TWINKLE_CYCLE_MS, easing: Easing.linear })),
      ),
    );
  }, [progress, glowIntensity, particleProgress, twinkleCycle]);

  const build: ArtBuilder = (root, own) => {
    const { width, height } = rect;
    const { primaryColor, glowColor, particleColor } = theme;
    const centerX = width / 2;
    const centerY = height * 0.42;
    const barThickness = Math.max(3, width * 0.025);
    const glow = graphicsLayer(root, { blur: SK.glowBlur });
    const glowFill = own(
      radialGradient(centerX, centerY, width * 0.5, [
        glowColor,
        `${primaryColor}60`,
        `${primaryColor}00`,
      ]),
    );
    const pillar = graphicsLayer(root, { blur: 15, screen: true });
    const crossHorizontal = graphicsLayer(root, { blur: 10, screen: true });
    const crossVertical = graphicsLayer(root, { blur: 10, screen: true });
    const halos = HALO_CONFIGS.map(() => graphicsLayer(root, { blur: 6, screen: true }));
    const ground = graphicsLayer(root, { blur: 20 });
    ground
      .circle(centerX, height, width * 0.6)
      .fill(
        own(
          radialGradient(centerX, height, width * 0.6, [`${primaryColor}40`, `${primaryColor}00`]),
        ),
      );
    const particles = graphicsLayer(root, { blur: SK.particleBlur, screen: true });

    return () => {
      const p = progress.get();
      const g = glowIntensity.get();
      glow.alpha = g * 0.7;
      glow
        .clear()
        .circle(centerX, centerY, width * 0.5 * (0.5 + g * 0.5))
        .fill(glowFill);

      pillar.alpha = pillarOpacity(p);
      pillar.clear();
      const pillarHeight = Math.min(1, p / 0.15) * height * 0.8;
      if (pillarHeight > 0) {
        pillar.rect(centerX - width * 0.15, 0, width * 0.3, pillarHeight).fill(primaryColor);
      }

      const crossAlpha = p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.08) / 0.3);
      const crossScale = Math.min(2, (p / 0.08) * 2);
      crossHorizontal.alpha = crossAlpha;
      crossVertical.alpha = crossAlpha;
      crossHorizontal.clear();
      crossVertical.clear();
      if (crossScale > 0 && crossAlpha > 0) {
        crossHorizontal
          .rect(
            centerX - width * crossScale,
            centerY - barThickness / 2,
            width * 2 * crossScale,
            barThickness,
          )
          .fill(particleColor);
        crossVertical
          .rect(
            centerX - barThickness / 2,
            centerY - height * crossScale,
            barThickness,
            height * 2 * crossScale,
          )
          .fill(particleColor);
      }

      HALO_CONFIGS.forEach((halo, i) => {
        const layer = halos[i]!;
        const lp = Math.min(1, Math.max(0, (p - halo.startP) / halo.durationP));
        layer.alpha = lp < 0.3 ? 0.8 : Math.max(0, 0.8 * (1 - (lp - 0.3) / 0.7));
        layer.clear();
        if (lp > 0)
          layer
            .circle(centerX, centerY, lp * width * 0.8)
            .stroke({ color: primaryColor, width: 2 });
      });

      ground.alpha = p < 0.2 ? (p / 0.2) * 0.25 : 0.25;

      const pp = particleProgress.get();
      const twinkle = twinkleCycle.get();
      const life = 1 - pp;
      particles.clear();
      if (life <= 0) return;
      for (const particle of GOD_PARTICLES) {
        const flicker = 0.5 + 0.5 * Math.sin(twinkle + particle.twinklePhase);
        particles
          .circle(
            centerX + particle.startX + particle.driftX * pp,
            centerY + particle.startY + particle.driftY * pp,
            particle.size,
          )
          .fill({ color: particleColor, alpha: particle.baseAlpha * life * flicker });
      }
    };
  };
  useFrameArt({ zIndex, rect }, build);
  return null;
}

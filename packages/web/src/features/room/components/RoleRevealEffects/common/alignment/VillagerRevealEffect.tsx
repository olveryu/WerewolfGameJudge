import { useEffect } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { graphicsLayer, radialGradient } from '../../pixi/kit';
import { drawSparkle } from '../../pixi/sparkle';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue } from '../../runtime';
import { useCanvasLayer } from '../useCanvasLayer';
import type { AlignmentEffectProps } from './types';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const RIPPLE_CONFIGS = [
  { startP: 0.05, durationP: 0.45, maxScale: 2.5, peakOpacity: 0.25 },
  { startP: 0.18, durationP: 0.47, maxScale: 3, peakOpacity: 0.15 },
] as const;

const FIREFLIES = Array.from({ length: AE.villagerFireflyCount }, (_, i) => ({
  phase: (i / AE.villagerFireflyCount) * 360,
  xRatio: 0.08 + ((i * 61 + 17) % 84) / 100,
  startYRatio: 0.55 + ((i * 37 + 11) % 40) / 100,
  driftRatio: 0.35 + ((i * 23 + 7) % 30) / 100,
  wobbleRatio: 0.03 + ((i * 13 + 3) % 40) / 1000,
  sizeRatio: (2 + (i % 3)) / 320,
}));

const STARS = Array.from({ length: AE.villagerStarCount }, (_, i) => {
  const angle = (i / AE.villagerStarCount) * Math.PI * 2 + ((i * 0.3) % 0.6);
  const radiusRatio = 0.32 + ((i * 17 + 5) % 18) / 100;
  return {
    xRatio: 0.5 + Math.cos(angle) * radiusRatio,
    yRatio: 0.42 + Math.sin(angle) * radiusRatio * 0.75,
    sizeRatio: (1.5 + (i % 3)) / 320,
    twinklePhase: ((i * 83 + 11) % 628) / 100,
  };
});

function flashOpacity(p: number): number {
  if (p < 0.06) return (p / 0.06) * 0.4;
  if (p < 0.15) return 0.4 * (1 - ((p - 0.06) / 0.09) * 0.6);
  if (p < 0.35) return 0.16 * (1 - (p - 0.15) / 0.2);
  return 0;
}

function starAlpha(sinValue: number): number {
  if (sinValue < -0.2) return 0.05 + ((sinValue + 1) / 0.8) * 0.1;
  if (sinValue < 0.2) return 0.15 + ((sinValue + 0.2) / 0.4) * 0.35;
  return 0.5 + ((sinValue - 0.2) / 0.8) * 0.35;
}

function fireflyAlpha(t: number): number {
  if (t < 0.12) return (t / 0.12) * 0.85;
  if (t < 0.65) return 0.85;
  return 0.85 * (1 - (t - 0.65) / 0.35);
}

/** Villager reveal: warm glow, a soft flash, shield ripples, twinkling stars and fireflies. */
export function VillagerRevealEffect({ rect, zIndex, theme }: AlignmentEffectProps) {
  const canvas = useCanvasLayer(zIndex, rect);
  const progress = useSharedValue(0);
  const appear = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const fireflyCycle = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);

  useEffect(() => {
    const outQuad = Easing.out(Easing.quad);
    const start = AE.effectStartDelay;
    progress.animate(withDelay(start, withTiming(1, { duration: 2500, easing: outQuad })));
    appear.animate(withDelay(start + 300, withTiming(1, { duration: 500, easing: outQuad })));
    glowIntensity.animate(
      withDelay(
        start,
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
          withTiming(0.5, { duration: 600, easing: outQuad }),
          withTiming(0.25, { duration: 1500, easing: outQuad }),
        ),
      ),
    );
    fireflyCycle.animate(
      withDelay(
        start,
        withRepeat(
          withTiming(360, { duration: AE.villagerFireflyDuration, easing: Easing.linear }),
        ),
      ),
    );
    twinkleCycle.animate(
      withDelay(
        start,
        withRepeat(
          withTiming(Math.PI * 2, { duration: AE.villagerTwinkleDuration, easing: Easing.linear }),
        ),
      ),
    );
  }, [progress, appear, glowIntensity, fireflyCycle, twinkleCycle]);

  const build: ArtBuilder = (root, own) => {
    const { width, height } = rect;
    const { primaryColor, glowColor, particleColor } = theme;
    const centerX = width / 2;
    const centerY = height * 0.42;
    const glow = graphicsLayer(root, { blur: SK.glowBlur });
    const glowFill = own(
      radialGradient(centerX, centerY, width * 0.45, [
        glowColor,
        `${primaryColor}50`,
        `${primaryColor}00`,
      ]),
    );
    const flash = graphicsLayer(root, { blur: 20 });
    flash
      .circle(centerX, centerY, width * 0.6)
      .fill(
        own(
          radialGradient(centerX, centerY, width * 0.6, [`${primaryColor}80`, `${primaryColor}00`]),
        ),
      );
    const ripples = RIPPLE_CONFIGS.map(() => graphicsLayer(root, { blur: 4, screen: true }));
    const starHalos = graphicsLayer(root, { blur: SK.particleBlur + 2, screen: true });
    const starSpikes = graphicsLayer(root, { screen: true });
    const fireflies = graphicsLayer(root, { blur: SK.particleBlur + 1, screen: true });
    const rippleBase = width * 0.12;

    return () => {
      const p = progress.get();
      const g = glowIntensity.get();
      const a = appear.get();
      glow.alpha = g * 0.55;
      glow
        .clear()
        .circle(centerX, centerY, width * 0.45 * (0.5 + g * 0.5))
        .fill(glowFill);
      flash.alpha = flashOpacity(p);

      RIPPLE_CONFIGS.forEach((ripple, i) => {
        const layer = ripples[i]!;
        const lp = Math.min(1, Math.max(0, (p - ripple.startP) / ripple.durationP));
        const peak = ripple.peakOpacity;
        layer.alpha =
          lp < 0.1 ? peak : lp < 0.4 ? peak * 0.8 : Math.max(0, peak * (1 - (lp - 0.4) / 0.6));
        layer
          .clear()
          .circle(centerX, centerY, rippleBase * (1 + lp * (ripple.maxScale - 1)))
          .stroke({ color: glowColor, width: 1.5 });
      });

      const twinkle = twinkleCycle.get();
      starHalos.clear();
      starSpikes.clear();
      for (const star of STARS) {
        const r = Math.max(1.5, star.sizeRatio * width);
        drawSparkle(starHalos, starSpikes, star.xRatio * width, star.yRatio * height, r, {
          color: particleColor,
          alpha: a * starAlpha(Math.sin(twinkle + star.twinklePhase)),
          bright: r > 2.5,
        });
      }

      const cycle = fireflyCycle.get();
      fireflies.clear();
      for (const firefly of FIREFLIES) {
        const phase = (cycle + firefly.phase) % 360;
        const t = phase / 360;
        fireflies
          .circle(
            firefly.xRatio * width +
              Math.sin(((phase * Math.PI) / 180) * 3) * firefly.wobbleRatio * width,
            firefly.startYRatio * height - t * firefly.driftRatio * height,
            Math.max(1.5, firefly.sizeRatio * width),
          )
          .fill({ color: particleColor, alpha: a * Math.max(0, fireflyAlpha(t)) });
      }
    };
  };
  useFrameArt(canvas, build);
  return null;
}

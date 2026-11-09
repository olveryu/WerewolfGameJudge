import { useEffect } from 'react';

import { svgPath } from '@/scene/art';
import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { graphicsLayer, radialGradient, shapeRadialGradient } from '../../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue } from '../../runtime';
import { useCanvasLayer } from '../useCanvasLayer';
import type { AlignmentEffectProps } from './types';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const SPARKS = Array.from({ length: AE.wolfSparkCount }, (_, i) => {
  const angle = (i / AE.wolfSparkCount) * Math.PI * 2 + (i % 3) * 0.15;
  const distRatio = 0.28 + ((i * 37) % 100) / 140;
  return {
    targetXRatio: Math.cos(angle) * distRatio,
    targetYRatio: Math.sin(angle) * distRatio,
    sizeRatio: (1.5 + ((i * 13) % 30) / 10) / 140,
    delay: 0.06 + (i / AE.wolfSparkCount) * 0.12,
    color: `hsl(${(i * 17) % 40}, 100%, ${50 + ((i * 13) % 30)}%)`,
  };
});

const BLOOD_DROPS = [
  { xRatio: 0.12, size: 5.5, speed: 2800, delay: 0 },
  { xRatio: 0.88, size: 5, speed: 3200, delay: 400 },
  { xRatio: 0.28, size: 5, speed: 3600, delay: 800 },
  { xRatio: 0.72, size: 6, speed: 2600, delay: 1200 },
  { xRatio: 0.5, size: 5, speed: 3400, delay: 600 },
] as const;

function teardropPath(r: number): string {
  const tipY = (-r * 2.2).toFixed(1);
  return (
    `M 0 ${tipY} Q ${(r * 0.4).toFixed(1)} ${(-r * 0.8).toFixed(1)} ${r.toFixed(1)} ` +
    `${(r * 0.2).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(-r).toFixed(1)} ` +
    `${(r * 0.2).toFixed(1)} Q ${(-r * 0.4).toFixed(1)} ${(-r * 0.8).toFixed(1)} 0 ${tipY} Z`
  );
}

const BLOOD_DROP_PATHS = BLOOD_DROPS.map((drop) => teardropPath(drop.size));
const BLOOD_COLOR = '#cc1111';

const FOG_CLOUDS = [
  { xRatio: 0.25, yRatio: 0.7, rRatio: 0.45, driftX: 8, driftYAmp: 6, alphaRatio: 0.5 },
  { xRatio: 0.75, yRatio: 0.65, rRatio: 0.4, driftX: -10, driftYAmp: 5, alphaRatio: 0.45 },
  { xRatio: 0.5, yRatio: 0.8, rRatio: 0.5, driftX: 6, driftYAmp: 8, alphaRatio: 0.55 },
  { xRatio: 0.35, yRatio: 0.75, rRatio: 0.3, driftX: -12, driftYAmp: 4, alphaRatio: 0.6 },
  { xRatio: 0.65, yRatio: 0.85, rRatio: 0.35, driftX: 10, driftYAmp: 7, alphaRatio: 0.5 },
  { xRatio: 0.15, yRatio: 0.9, rRatio: 0.2, driftX: 15, driftYAmp: 10, alphaRatio: 0.7 },
  { xRatio: 0.85, yRatio: 0.78, rRatio: 0.22, driftX: -14, driftYAmp: 9, alphaRatio: 0.65 },
  { xRatio: 0.5, yRatio: 0.95, rRatio: 0.38, driftX: -5, driftYAmp: 6, alphaRatio: 0.4 },
] as const;

function bloodStreakOpacity(p: number): number {
  if (p < 0.08) return 0;
  if (p > 0.85) return Math.max(0, (1 - p) / 0.15) * 0.2;
  return Math.min(0.2, (p - 0.08) * 0.8);
}

function bloodDropOpacity(p: number): number {
  if (p < 0.05) return p / 0.05;
  if (p > 0.85) return Math.max(0, (1 - p) / 0.15);
  return 0.9;
}

/** Werewolf reveal: red glow, drifting fog, dripping blood, glowing eyes, shock rings, sparks. */
export function WolfRevealEffect({ rect, zIndex, theme }: AlignmentEffectProps) {
  const canvas = useCanvasLayer(zIndex, rect);
  const progress = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const fogDrift = useSharedValue(0);
  const eyePulse = useSharedValue(0);
  const bloodCycle = useSharedValue(0);

  useEffect(() => {
    const outQuad = Easing.out(Easing.quad);
    const pulse = Easing.inOut(Easing.sin);
    progress.animate(
      withDelay(AE.effectStartDelay, withTiming(1, { duration: 2500, easing: outQuad })),
    );
    glowIntensity.animate(
      withDelay(
        AE.effectStartDelay,
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
          withTiming(0.6, { duration: 575, easing: outQuad }),
          withTiming(0.35, { duration: 1625, easing: outQuad }),
        ),
      ),
    );
    fogDrift.animate(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear })));
    eyePulse.animate(
      withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1200, easing: pulse }),
            withTiming(0, { duration: 1200, easing: pulse }),
          ),
        ),
      ),
    );
    bloodCycle.animate(
      withDelay(
        AE.effectStartDelay,
        withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear })),
      ),
    );
  }, [progress, glowIntensity, fogDrift, eyePulse, bloodCycle]);

  const build: ArtBuilder = (root, own) => {
    const { width, height } = rect;
    const { primaryColor, glowColor } = theme;
    const centerX = width / 2;
    const centerY = height * 0.42;
    const eyeY = height * 0.3;
    const glow = graphicsLayer(root, { blur: SK.glowBlur });
    const glowFill = own(
      radialGradient(centerX, centerY, width * 0.6, [
        glowColor,
        `${primaryColor}60`,
        `${primaryColor}00`,
      ]),
    );
    const fog = graphicsLayer(root, { blur: 25 });
    const fogFill = own(
      shapeRadialGradient(
        [`${primaryColor}90`, `${primaryColor}40`, `${primaryColor}00`],
        [0, 0.5, 1],
      ),
    );
    const blood = graphicsLayer(root);
    const bloodPaths = BLOOD_DROP_PATHS.map(svgPath);
    const eyes = [-1, 1].map((side) => {
      const eyeX = centerX + side * width * 0.12;
      const eye = graphicsLayer(root, { blur: 8, screen: true });
      eye
        .circle(eyeX, eyeY, 5)
        .fill(own(radialGradient(eyeX, eyeY, 12, [primaryColor, `${primaryColor}00`])));
      return eye;
    });
    const wave1 = graphicsLayer(root, { blur: 4, screen: true });
    const wave2 = graphicsLayer(root, { blur: 3, screen: true });
    const sparks = graphicsLayer(root, { blur: SK.particleBlur, screen: true });

    return () => {
      const p = progress.get();
      const g = glowIntensity.get();
      glow.alpha = g * 0.6;
      glow
        .clear()
        .circle(centerX, centerY, width * 0.6 * (0.5 + g * 0.5))
        .fill(glowFill);

      const drift = fogDrift.get();
      fog.clear();
      FOG_CLOUDS.forEach((cloud, i) => {
        const r = cloud.rRatio * width;
        const x = cloud.xRatio * width + Math.sin(drift * Math.PI * 2 + i) * cloud.driftX;
        const y =
          cloud.yRatio * height + Math.cos(drift * Math.PI * 2 * 0.7 + i * 1.3) * cloud.driftYAmp;
        const alpha = cloud.alphaRatio * (0.8 + 0.2 * Math.sin(drift * Math.PI + i * 2));
        fog.circle(x, y, r).fill({ fill: fogFill, alpha });
      });

      const timeMs = bloodCycle.get() * 1000;
      blood.clear();
      BLOOD_DROPS.forEach((drop, i) => {
        const x = drop.xRatio * width;
        const dropP = (Math.max(0, timeMs - drop.delay) % drop.speed) / drop.speed;
        const y = dropP * height * 0.95;
        const streakHeight = Math.max(0, y - drop.size * 2);
        const streakAlpha = bloodStreakOpacity(dropP);
        if (streakHeight > 0 && streakAlpha > 0) {
          const streakWidth = drop.size * 0.6;
          blood
            .rect(x - streakWidth / 2, 0, streakWidth, streakHeight)
            .fill({ color: BLOOD_COLOR, alpha: streakAlpha });
        }
        const dropAlpha = bloodDropOpacity(dropP);
        if (dropAlpha > 0) {
          blood.save().translateTransform(x, y);
          blood.path(bloodPaths[i]!).fill({ color: BLOOD_COLOR, alpha: dropAlpha });
          blood.restore();
        }
      });

      const eyeAlpha = 0.3 + eyePulse.get() * 0.5;
      for (const eye of eyes) eye.alpha = eyeAlpha;

      const wave1Radius = p * width * 0.8;
      wave1.clear();
      wave1.alpha = Math.max(0, 0.5 - p * 0.7);
      if (wave1Radius > 0) {
        wave1.circle(centerX, centerY, wave1Radius).stroke({ color: primaryColor, width: 2 });
      }
      const late = Math.max(0, p - 0.15);
      wave2.clear();
      wave2.alpha = Math.max(0, 0.3 - late * 0.5);
      if (late > 0) {
        wave2.circle(centerX, centerY, late * width * 0.9).stroke({
          color: primaryColor,
          width: 1.5,
        });
      }

      sparks.clear();
      for (const spark of SPARKS) {
        const lp = Math.min(1, Math.max(0, (p - spark.delay) / 0.35));
        const alpha = lp < 0.05 ? lp / 0.05 : Math.max(0, 1 - (lp - 0.05) / 0.6);
        const r = Math.max(1, spark.sizeRatio * width) * Math.max(0, 1 - lp);
        if (r <= 0 || alpha <= 0) continue;
        sparks
          .circle(
            centerX + spark.targetXRatio * width * lp,
            centerY + spark.targetYRatio * width * lp,
            r,
          )
          .fill({ color: spark.color, alpha });
      }
    };
  };
  useFrameArt(canvas, build);
  return null;
}

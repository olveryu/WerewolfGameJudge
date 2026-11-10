import { useEffect } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { graphicsLayer, radialGradient } from '../../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue } from '../../runtime';
import type { AlignmentEffectProps } from './types';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const ORBIT_PARTICLES = Array.from({ length: AE.thirdParticleCount }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  return {
    phaseOffset: (i / AE.thirdParticleCount) * 360,
    radiusOffsetRatio: 0.17 * ((i % 3) - 1),
    sizeRatio: (2 + (i % 2)) / 140,
    driftY: (r1 - 0.5) * 8,
    twinklePhase: r2 * Math.PI * 2,
  };
});

const ARC_COUNT = 6;
const ARCS = Array.from({ length: ARC_COUNT }, (_, i) => ({
  angle: (i / ARC_COUNT) * Math.PI * 2,
  lengthRatio: 0.25 + ((i * 37 + 11) % 20) / 100,
}));

function arcOpacity(p: number): number {
  if (p < 0.05) return (p / 0.05) * 0.6;
  if (p < 0.2) return 0.6;
  return Math.max(0, 0.6 * (1 - (p - 0.2) / 0.3));
}

interface RuneRingStyle {
  readonly radius: number;
  readonly dashOn: number;
  readonly dashOff: number;
  readonly color: string;
}

/** Draws a dashed ring around the origin as per-dash arcs, as the old rune ring path did. */
function drawRuneRing(
  ring: ReturnType<typeof graphicsLayer>,
  { radius, dashOn, dashOff, color }: RuneRingStyle,
) {
  const circumference = 2 * Math.PI * radius;
  const segmentCount = Math.floor(circumference / (dashOn + dashOff));
  const segmentAngle = (2 * Math.PI) / Math.max(1, segmentCount);
  const dashAngle = segmentAngle * (dashOn / (dashOn + dashOff));
  for (let i = 0; i < segmentCount; i++) {
    const start = i * segmentAngle;
    ring.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    ring.arc(0, 0, radius, start, start + dashAngle);
  }
  ring.stroke({ color, width: 1, cap: 'round' });
}

/** Third-party reveal: violet glow, lightning arcs, counter-rotating rune rings, a pulsing core. */
export function ThirdRevealEffect({ rect, zIndex, theme }: AlignmentEffectProps) {
  const appear = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const progress = useSharedValue(0);
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const particleOrbit = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const corePulse = useSharedValue(0);

  useEffect(() => {
    const outQuad = Easing.out(Easing.quad);
    const start = AE.effectStartDelay;
    const spin = (to: number, duration: number) =>
      withDelay(start, withRepeat(withTiming(to, { duration, easing: Easing.linear })));
    progress.animate(withDelay(start, withTiming(1, { duration: 2500, easing: outQuad })));
    appear.animate(withDelay(start + 300, withTiming(1, { duration: 500, easing: outQuad })));
    glowIntensity.animate(
      withDelay(
        start,
        withSequence(
          withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
          withTiming(0.6, { duration: 625, easing: outQuad }),
          withTiming(0.3, { duration: 1500, easing: outQuad }),
        ),
      ),
    );
    outerRotation.animate(spin(360, AE.thirdRuneRotationDuration));
    innerRotation.animate(spin(-360, AE.thirdInnerRingDuration));
    particleOrbit.animate(spin(360, AE.thirdOrbitDuration));
    twinkleCycle.animate(spin(Math.PI * 2, 1200));
    const pulse = Easing.inOut(Easing.quad);
    corePulse.animate(
      withDelay(
        start + 500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: pulse }),
            withTiming(0, { duration: 1500, easing: pulse }),
          ),
        ),
      ),
    );
  }, [
    appear,
    glowIntensity,
    progress,
    outerRotation,
    innerRotation,
    particleOrbit,
    twinkleCycle,
    corePulse,
  ]);

  const build: ArtBuilder = (root, own) => {
    const { width, height } = rect;
    const { primaryColor, glowColor, particleColor } = theme;
    const centerX = width / 2;
    const centerY = height * 0.42;
    const glow = graphicsLayer(root, { blur: SK.glowBlur });
    const glowFill = own(
      radialGradient(centerX, centerY, width * 0.5, [
        glowColor,
        `${primaryColor}60`,
        `${primaryColor}00`,
      ]),
    );
    const arcs = graphicsLayer(root, { blur: 2, screen: true });
    for (const arc of ARCS) {
      const segmentLength = (width * arc.lengthRatio) / 5;
      arcs.moveTo(centerX, centerY);
      for (let s = 1; s <= 5; s++) {
        const jag = (((s * 37 + Math.round(arc.angle * 10)) % 20) - 10) * 0.3;
        const distance = segmentLength * s;
        arcs.lineTo(
          centerX + Math.cos(arc.angle) * distance + Math.cos(arc.angle + Math.PI / 2) * jag,
          centerY + Math.sin(arc.angle) * distance + Math.sin(arc.angle + Math.PI / 2) * jag,
        );
      }
    }
    arcs.stroke({ color: particleColor, width: 1.5 });
    const outerRadius = width * 0.52;
    const outerRing = graphicsLayer(root, { blur: 1 });
    drawRuneRing(outerRing, { radius: outerRadius, dashOn: 6, dashOff: 12, color: glowColor });
    const innerRing = graphicsLayer(root, { blur: 1 });
    drawRuneRing(innerRing, {
      radius: outerRadius * 0.82,
      dashOn: 3,
      dashOff: 8,
      color: primaryColor,
    });
    for (const ring of [outerRing, innerRing]) ring.position.set(centerX, centerY);
    const coreGlow = graphicsLayer(root, { blur: 10 });
    const coreGlowFill = own(
      radialGradient(centerX, centerY, width * 0.15, [`${glowColor}80`, `${primaryColor}00`]),
    );
    const core = graphicsLayer(root, { blur: 4 });
    const orbit = graphicsLayer(root, { blur: SK.particleBlur, screen: true });
    const orbitBase = width * 0.35;

    return () => {
      const g = glowIntensity.get();
      const a = appear.get();
      const pulse = corePulse.get();
      glow.alpha = g * 0.65;
      glow
        .clear()
        .circle(centerX, centerY, width * 0.5 * (0.5 + g * 0.5))
        .fill(glowFill);
      arcs.alpha = arcOpacity(progress.get());
      outerRing.alpha = a * 0.7;
      innerRing.alpha = a * 0.7;
      outerRing.rotation = (outerRotation.get() * Math.PI) / 180;
      innerRing.rotation = (innerRotation.get() * Math.PI) / 180;
      const coreAlpha = a * (0.4 + pulse * 0.3);
      coreGlow.alpha = coreAlpha;
      core.alpha = coreAlpha;
      coreGlow
        .clear()
        .circle(centerX, centerY, width * 0.15 * (0.6 + pulse * 0.4))
        .fill(coreGlowFill);
      core
        .clear()
        .circle(centerX, centerY, width * 0.06 * (0.7 + pulse * 0.3))
        .fill(glowColor);

      const orbitDegrees = particleOrbit.get();
      const twinkle = twinkleCycle.get();
      orbit.clear();
      for (const particle of ORBIT_PARTICLES) {
        const angle = ((orbitDegrees + particle.phaseOffset) * Math.PI) / 180;
        const radius =
          orbitBase + particle.radiusOffsetRatio * orbitBase + Math.sin(angle * 3) * width * 0.057;
        const flicker = 0.5 + 0.5 * Math.sin(twinkle + particle.twinklePhase);
        orbit
          .circle(
            Math.cos(angle) * radius + centerX,
            Math.sin(angle) * radius + centerY + particle.driftY,
            Math.max(1, particle.sizeRatio * width),
          )
          .fill({ color: particleColor, alpha: a * 0.7 * flicker });
      }
    };
  };
  useFrameArt({ zIndex, rect }, build);
  return null;
}

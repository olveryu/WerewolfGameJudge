/**
 * Snowfall: 10 six-pointed snowflakes drift down and slowly turn. Each flake is static art
 * (three crossing arms and a centre dot) moved by a layer sampler. Ported from the RN client's
 * `SnowfallFlair`.
 */
import type { DecorationSpec, LayerArt, LayerNode, LayerSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const FLAKE_COUNT = 10;
const ARM_COUNT = 3;
const RAD_TO_DEG = 180 / Math.PI;
const ARM_COLOR = 0xdce6ff;
const CENTRE_COLOR = 0xf0f5ff;

const FLAKE_SEEDS = Array.from({ length: FLAKE_COUNT }, (_, i) => ({
  xFraction: 0.05 + (i * 0.9) / (FLAKE_COUNT - 1),
  phase: i / FLAKE_COUNT,
  radiusFraction: 0.008 + (i % 3) * 0.005,
  speed: 0.4 + (i % 4) * 0.1,
  sway: 0.02 + (i % 3) * 0.015,
}));

type FlakeSeed = (typeof FLAKE_SEEDS)[number];

const ARM_ANGLES = Array.from({ length: ARM_COUNT }, (_, i) => (i / ARM_COUNT) * Math.PI);

/** Each flake runs at its own speed, so its phase stays inside the sampler (node phase is 0). */
function flakeSampler(seed: FlakeSeed): LayerSampler {
  return (t, size) => {
    const progress = (t * seed.speed + seed.phase) % 1;
    const fadeIn = progress / 0.05;
    const fadeOut = (1 - progress) / 0.1;
    return {
      x: seed.xFraction * size + Math.sin(progress * Math.PI * 4) * size * seed.sway,
      y: progress * size,
      rotateDeg: progress * Math.PI * RAD_TO_DEG,
      scaleX: 1,
      scaleY: 1,
      opacity: progress < 0.05 ? fadeIn : progress > 0.9 ? fadeOut : 0.7,
    };
  };
}

function flakeArt(seed: FlakeSeed): LayerArt {
  return (context, size) => {
    const radius = seed.radiusFraction * size;
    for (const angle of ARM_ANGLES) {
      context
        .moveTo(-Math.cos(angle) * radius, -Math.sin(angle) * radius)
        .lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        .stroke({ color: ARM_COLOR, width: 0.8, alpha: 0.8 });
    }
    context.circle(0, 0, size * 0.005).fill({ color: CENTRE_COLOR, alpha: 0.9 });
  };
}

const nodes: LayerNode[] = FLAKE_SEEDS.map((seed) => ({
  kind: 'layer',
  sample: flakeSampler(seed),
  art: flakeArt(seed),
  durationMs: LOOP_MS,
  phase: 0,
}));

export const snowfallFlair: DecorationSpec = { id: 'snowfall', nodes };

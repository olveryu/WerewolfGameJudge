/** Glowworms: 8 bioluminescent particles drift around the avatar with a breathing pulse. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const COUNT = 8;
const COLORS = [
  'rgb(0,255,180)',
  'rgb(80,255,200)',
  'rgb(0,200,160)',
  'rgb(40,255,220)',
  'rgb(0,220,180)',
  'rgb(60,240,200)',
  'rgb(20,255,160)',
  'rgb(0,200,200)',
] as const;

const GLOW_SEEDS = Array.from({ length: COUNT }, (_, i) => ({
  orbitR: 0.38 + (i % 3) * 0.05,
  angleOff: (i / COUNT) * Math.PI * 2,
  phase: i / COUNT,
  pulseSpeed: 2 + (i % 3),
  ci: i % COLORS.length,
}));

type GlowSeed = (typeof GLOW_SEEDS)[number];

function glowCentre(
  t: number,
  size: number,
  seed: GlowSeed,
): { x: number; y: number; pulse: number } {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 * 0.3 + seed.angleOff;
  const pulse = 0.5 + Math.sin(t * Math.PI * 2 * seed.pulseSpeed) * 0.5;
  return {
    x: cx + Math.cos(angle) * seed.orbitR * size,
    y: cy + Math.sin(angle) * seed.orbitR * size,
    pulse,
  };
}

const HALO_SAMPLERS: readonly DotSampler[] = GLOW_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = glowCentre(t, size, seed);
  return { cx: x, cy: y, r: size * 0.03 * (0.5 + pulse * 0.5), opacity: pulse * 0.15 };
});

const CORE_SAMPLERS: readonly DotSampler[] = GLOW_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = glowCentre(t, size, seed);
  return { cx: x, cy: y, r: size * 0.01 * (0.6 + pulse * 0.4), opacity: pulse * 0.7 };
});

const nodes = GLOW_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'dot',
    sample: HALO_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: COLORS[seed.ci]!,
  },
  {
    kind: 'dot',
    sample: CORE_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(200,255,230)',
  },
]);

export const nightGlowFlair: DecorationSpec = { id: 'nightGlow', nodes };

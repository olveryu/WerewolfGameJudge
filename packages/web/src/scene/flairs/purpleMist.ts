/**
 * Purple Mist: 7 purple mist clusters drift and pulse around the avatar. The phase enters the
 * drift, wobble and pulse with different weights, so it stays in the sampler.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 6000;
const N = 7;

const MIST_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.35 + (i % 3) * 0.05,
  phase: i / N,
  driftSpeed: 0.3 + (i % 4) * 0.15,
  maxRFrac: 0.04 + (i % 3) * 0.02,
}));

type MistSeed = (typeof MIST_SEEDS)[number];

const MIST_SAMPLERS: readonly LayerSampler[] = MIST_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + Math.sin((t * seed.driftSpeed + seed.phase) * Math.PI * 2) * 0.6;
  const dist = seed.dist * size + Math.sin(t * Math.PI * 2 + seed.phase * 5) * size * 0.04;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + seed.phase * 4) * Math.PI));
  const r = seed.maxRFrac * size * (0.6 + 0.4 * pulse);
  const scale = r / (seed.maxRFrac * size);
  return { x, y, rotateDeg: 0, scaleX: scale, scaleY: scale, opacity: pulse };
});

/** Cluster centred on the origin at the full radius `maxRFrac × size`. */
function mistArt(seed: MistSeed): StaticArt {
  return (context, size) => {
    const r = seed.maxRFrac * size;
    context.circle(0, 0, r).fill({ color: 'rgb(80,30,160)', alpha: 0.08 });
    context.circle(0, 0, r * 0.6).fill({ color: 'rgb(100,50,180)', alpha: 0.15 });
    context.circle(0, 0, r * 0.3).fill({ color: 'rgb(140,80,200)', alpha: 0.25 });
  };
}

const nodes = MIST_SEEDS.map((seed, i): LayerNode => ({
  kind: 'layer',
  sample: MIST_SAMPLERS[i]!,
  art: mistArt(seed),
  durationMs: LOOP_MS,
}));

export const purpleMistFlair: DecorationSpec = { id: 'purpleMist', nodes };

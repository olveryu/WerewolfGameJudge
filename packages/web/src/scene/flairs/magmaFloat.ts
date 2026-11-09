/**
 * Magma Float: 6 irregular magma rocks float at the periphery, overlapping circles with a heat
 * glow below. Each rock is rigid art moved by a layer. Position uses the phase-shifted time and
 * the pulse its own phase term, so the phase stays in the sampler.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 6;

const MAGMA_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2 + i * 0.4,
  dist: 0.35 + (i % 3) * 0.06,
  phase: i / N,
  rFrac: 0.018 + (i % 3) * 0.007,
}));

const MAGMA_SAMPLERS: readonly LayerSampler[] = MAGMA_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const tt = (t + seed.phase) % 1;
  const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
  const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
  return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: pulse };
});

const MAGMA_ARTS: readonly StaticArt[] = MAGMA_SEEDS.map((seed) => (context, size) => {
  const r = seed.rFrac * size;
  context.circle(0, 0, r).fill({ color: 'rgb(200,60,20)', alpha: 0.6 });
  context.circle(r * 0.4, -r * 0.3, r * 0.7).fill({ color: 'rgb(240,120,20)', alpha: 0.5 });
  context.circle(0, r * 0.5, r * 1.3).fill({ color: 'rgb(255,80,0)', alpha: 0.12 });
});

const nodes = MAGMA_SEEDS.map(
  (_, i): LayerNode => ({
    kind: 'layer',
    sample: MAGMA_SAMPLERS[i]!,
    art: MAGMA_ARTS[i]!,
    durationMs: LOOP_MS,
  }),
);

export const magmaFloatFlair: DecorationSpec = { id: 'magmaFloat', nodes };

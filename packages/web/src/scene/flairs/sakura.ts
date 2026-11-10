/**
 * Sakura: 6 cherry petals drift down with a gentle sway, fading at the bottom. Each petal is a
 * rigid cross of 5 dots turning by `t × π`, so one layer rotates static art.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 6;
const PETAL_R_FRAC = 0.015;
const RAD_TO_DEG = 180 / Math.PI;

const PETAL_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.1 + (i * 0.8) / (N - 1),
  phase: i / N,
  swayAmp: 0.04 + (i % 3) * 0.02,
  swayFreq: 1.5 + (i % 2) * 0.5,
}));

const PETAL_SAMPLERS: readonly LayerSampler[] = PETAL_SEEDS.map((seed) => (t, size) => {
  const y = t * size;
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
  const a = t * Math.PI;
  return { x, y, rotateDeg: a * RAD_TO_DEG, scaleX: 1, scaleY: 1, opacity: alpha };
});

/** Petal at `a = 0`: centre, forward and back along ±x, sides along ±y. */
const petalArt: StaticArt = (context, size) => {
  const r = size * PETAL_R_FRAC;
  const dx = r * 0.6;
  context.circle(0, 0, r).fill('rgb(255,183,197)');
  context.circle(dx, 0, r * 0.8).fill('rgb(255,183,197)');
  context.circle(-dx, 0, r * 0.8).fill('rgb(255,183,197)');
  context.circle(0, -dx, r * 0.6).fill({ color: 'rgb(255,210,220)', alpha: 0.6 });
  context.circle(0, dx, r * 0.6).fill({ color: 'rgb(255,210,220)', alpha: 0.6 });
};

const nodes = PETAL_SEEDS.map(
  (seed, i): LayerNode => ({
    kind: 'layer',
    sample: PETAL_SAMPLERS[i]!,
    art: petalArt,
    durationMs: LOOP_MS,
    phase: seed.phase,
  }),
);

export const sakuraFlair: DecorationSpec = { id: 'sakura', nodes };

/** Shadow Mist: 5 purple-black smoke puffs rise from the bottom, spread and fade. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 5;

const MIST_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (N - 1),
  phase: i / N,
  maxR: 0.06 + (i % 3) * 0.02,
}));

const MIST_SAMPLERS: readonly DotSampler[] = MIST_SEEDS.map((seed) => (t, size) => {
  const y = size * (1 - t * 0.6);
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 3) * size * 0.03;
  const r = seed.maxR * size * (0.3 + t * 0.7);
  const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.4;
  return { cx: x, cy: y, r, opacity: alpha };
});

const nodes = MIST_SEEDS.map((seed, i): DecorationNode => ({
  kind: 'dot',
  sample: MIST_SAMPLERS[i]!,
  durationMs: LOOP_MS,
  phase: seed.phase,
  color: 'rgb(42,16,64)',
}));

export const shadowMistFlair: DecorationSpec = { id: 'shadowMist', nodes };

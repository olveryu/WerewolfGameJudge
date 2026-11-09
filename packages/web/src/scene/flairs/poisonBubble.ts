/** Poison Bubble: 8 green bubbles rise and swell, each a ring with a glossy highlight. */
import type { DecorationNode, DecorationSpec, DotSampler, RingSampler } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 8;

const BUBBLE_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (N - 1),
  phase: i / N,
  rFrac: 0.02 + (i % 3) * 0.008,
  speed: 0.6 + (i % 4) * 0.1,
}));

type BubbleSeed = (typeof BUBBLE_SEEDS)[number];

function bubbleFrame(seed: BubbleSeed, t: number, size: number) {
  const tt = (t * seed.speed + seed.phase) % 1;
  const y = size * (1 - tt * 0.9) - size * 0.05;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
  const r = seed.rFrac * size * (1 + tt * 0.3);
  return { x, y, alpha, r };
}

function outlineSampler(seed: BubbleSeed): RingSampler {
  return (t, size) => {
    const { x, y, alpha, r } = bubbleFrame(seed, t, size);
    return { cx: x, cy: y, r, strokeWidth: 1, opacity: alpha * 0.7 };
  };
}

function highlightSampler(seed: BubbleSeed): DotSampler {
  return (t, size) => {
    const { x, y, alpha, r } = bubbleFrame(seed, t, size);
    return { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.25, opacity: alpha * 0.5 };
  };
}

const nodes = BUBBLE_SEEDS.flatMap((seed): DecorationNode[] => [
  { kind: 'ring', sample: outlineSampler(seed), durationMs: LOOP_MS, color: 'rgb(80,220,80)' },
  { kind: 'dot', sample: highlightSampler(seed), durationMs: LOOP_MS, color: 'rgb(150,255,150)' },
]);

export const poisonBubbleFlair: DecorationSpec = { id: 'poisonBubble', nodes };

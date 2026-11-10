/**
 * Gold Spark: 8 four-pointed stars burst outward from the perimeter and fade. The burst runs at
 * 1.5× loop speed with the seed phase added before the wrap, so the phase stays in the sampler.
 */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const LOOP_MS = 3500;
const N = 8;

const SPARKLE_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2 + i * 0.7,
  dist: 0.35 + (i % 4) * 0.04,
  phase: i / N,
  burst: 0.3 + (i % 3) * 0.1,
}));

type SparkleSeed = (typeof SPARKLE_SEEDS)[number];

function sparkleFrame(seed: SparkleSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const tt = (t * 1.5 + seed.phase) % 1;
  const burstDist = seed.dist * size + tt * size * seed.burst;
  const angle = seed.angle + Math.sin(t * Math.PI * 2) * 0.2;
  const x = cx + Math.cos(angle) * burstDist;
  const y = cy + Math.sin(angle) * burstDist;
  const tooClose = burstDist < size * 0.25;
  const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
  const armLen = size * 0.02 * (1 - tt * 0.5);
  return { x, y, tooClose, alpha, armLen };
}

function hLineSampler(seed: SparkleSeed): LineSampler {
  return (t, size) => {
    const { x, y, tooClose, alpha, armLen } = sparkleFrame(seed, t, size);
    return {
      x1: x - armLen,
      y1: y,
      x2: x + armLen,
      y2: y,
      opacity: tooClose ? 0 : alpha * 0.8,
      strokeWidth: 1.2,
    };
  };
}

function vLineSampler(seed: SparkleSeed): LineSampler {
  return (t, size) => {
    const { x, y, tooClose, alpha, armLen } = sparkleFrame(seed, t, size);
    return {
      x1: x,
      y1: y - armLen,
      x2: x,
      y2: y + armLen,
      opacity: tooClose ? 0 : alpha * 0.8,
      strokeWidth: 1.2,
    };
  };
}

function dotSampler(seed: SparkleSeed): DotSampler {
  return (t, size) => {
    const { x, y, tooClose, alpha } = sparkleFrame(seed, t, size);
    return { cx: x, cy: y, r: size * 0.01, opacity: tooClose ? 0 : alpha * 0.9 };
  };
}

const nodes = SPARKLE_SEEDS.flatMap((seed): DecorationNode[] => [
  { kind: 'line', sample: hLineSampler(seed), durationMs: LOOP_MS, color: 'rgb(255,210,60)' },
  { kind: 'line', sample: vLineSampler(seed), durationMs: LOOP_MS, color: 'rgb(255,210,60)' },
  { kind: 'dot', sample: dotSampler(seed), durationMs: LOOP_MS, color: 'rgb(255,240,150)' },
]);

export const goldSparkFlair: DecorationSpec = { id: 'goldSpark', nodes };

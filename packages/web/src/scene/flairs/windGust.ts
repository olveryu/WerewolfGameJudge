/**
 * Wind Gust: 8 short streaks blow left to right around the central area, each led by a bright
 * dot. The phase is applied after the per-streak speed, so it stays in the sampler.
 */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const LOOP_MS = 3000;
const N = 8;

const WIND_SEEDS = Array.from({ length: N }, (_, i) => ({
  yFrac: 0.1 + (i / N) * 0.8,
  phase: i / N,
  speed: 1.2 + (i % 3) * 0.3,
  rFrac: 0.008 + (i % 4) * 0.003,
}));

type WindSeed = (typeof WIND_SEEDS)[number];

interface WindState {
  x: number;
  y: number;
  tooClose: boolean;
  alpha: number;
}

function windState(t: number, size: number, seed: WindSeed): WindState {
  const cx = size / 2;
  const cy = size / 2;
  const safe = size * 0.22;
  const tt = (t * seed.speed + seed.phase) % 1;
  const x = tt * size;
  const baseY = seed.yFrac * size;
  const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;
  const dx = x - cx;
  const dy = y - cy;
  const tooClose = dx * dx + dy * dy < safe * safe;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
  return { x, y, tooClose, alpha };
}

function lineSampler(seed: WindSeed): LineSampler {
  return (t, size) => {
    const { x, y, tooClose, alpha } = windState(t, size, seed);
    const streakLen = size * 0.04;
    return {
      x1: x,
      y1: y,
      x2: x - streakLen,
      y2: y + 0.5,
      strokeWidth: seed.rFrac * size * 2,
      opacity: tooClose ? 0 : alpha * 0.7,
    };
  };
}

function dotSampler(seed: WindSeed): DotSampler {
  return (t, size) => {
    const { x, y, tooClose, alpha } = windState(t, size, seed);
    return { cx: x, cy: y, r: seed.rFrac * size, opacity: tooClose ? 0 : alpha * 0.6 };
  };
}

const nodes = WIND_SEEDS.flatMap((seed): DecorationNode[] => [
  { kind: 'line', sample: lineSampler(seed), durationMs: LOOP_MS, color: 'rgb(180,230,200)' },
  { kind: 'dot', sample: dotSampler(seed), durationMs: LOOP_MS, color: 'rgb(200,245,220)' },
]);

export const windGustFlair: DecorationSpec = { id: 'windGust', nodes };

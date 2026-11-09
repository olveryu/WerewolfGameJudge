/** Willow Wisp: 6 wisps drift on slow Lissajous paths with flicker, each a halo over a core. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 5000;
const WISP_COUNT = 6;
const COLORS = [
  'rgb(100,255,180)',
  'rgb(80,240,160)',
  'rgb(120,255,200)',
  'rgb(90,230,170)',
  'rgb(110,250,190)',
  'rgb(80,220,155)',
] as const;

const WISP_SEEDS = Array.from({ length: WISP_COUNT }, (_, i) => ({
  ax: 0.2 + (i % 3) * 0.08,
  ay: 0.15 + (i % 4) * 0.06,
  bx: i * 1.1,
  by: i * 0.7,
  freqX: 1 + (i % 2) * 0.5,
  freqY: 0.8 + (i % 3) * 0.3,
  phase: i / WISP_COUNT,
  ci: i % COLORS.length,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

function wispPosition(t: number, size: number, seed: WispSeed): { x: number; y: number } {
  const cx = size / 2;
  const cy = size / 2;
  return {
    x: cx + Math.sin(t * Math.PI * 2 * seed.freqX) * seed.ax * size,
    y: cy + Math.cos(t * Math.PI * 2 * seed.freqY + seed.bx) * seed.ay * size,
  };
}

function haloSampler(seed: WispSeed): DotSampler {
  return (t, size) => {
    const { x, y } = wispPosition(t, size, seed);
    const flicker = 0.4 + Math.sin(t * Math.PI * 6 + seed.by) * 0.25;
    return { cx: x, cy: y, r: size * 0.025, opacity: flicker * 0.3 };
  };
}

function coreSampler(seed: WispSeed): DotSampler {
  return (t, size) => {
    const { x, y } = wispPosition(t, size, seed);
    const flicker = 0.5 + Math.sin(t * Math.PI * 6 + seed.by) * 0.3;
    return { cx: x, cy: y, r: size * 0.008, opacity: flicker };
  };
}

const nodes = WISP_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'dot',
    sample: haloSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: COLORS[seed.ci]!,
  },
  {
    kind: 'dot',
    sample: coreSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(220,255,240)',
  },
]);

export const willowWispFlair: DecorationSpec = { id: 'willowWisp', nodes };

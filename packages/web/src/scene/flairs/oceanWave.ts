/**
 * Ocean Wave: 3 waves roll along the bottom with crest foam and spray. Each wave travels
 * horizontally, so a static curve `1 + 4 / freq` tiles wide slides inside a clip to the tile.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerNode,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 4000;
const WAVE_COUNT = 3;
/** Polyline vertices per tile width. */
const STEPS_PER_TILE = 8;
/** Temporal angular speed of the wave, in radians per loop. */
const WAVE_OMEGA = Math.PI * 4;

const WAVE_SEEDS = Array.from({ length: WAVE_COUNT }, (_, i) => ({
  yBase: 0.75 + i * 0.08,
  amplitude: 0.03 + i * 0.01,
  phase: i / WAVE_COUNT,
  freq: 2 + i,
}));

type WaveSeed = (typeof WAVE_SEEDS)[number];

/** `sin(k x + ω t)` travels toward −x by `ω t / k`; one loop covers `4 / freq` tiles. */
function travelTiles(seed: WaveSeed): number {
  return WAVE_OMEGA / (Math.PI * seed.freq);
}

/** Curve width in tiles: one visible tile plus the full travel. */
function curveWidthFactor(seed: WaveSeed): number {
  return 1 + travelTiles(seed);
}

/** Static wave at `t = 0`, drawn across `curveWidthFactor` tiles. */
function wavePath(seed: WaveSeed, size: number): string {
  const yOff = seed.yBase * size;
  const width = size * curveWidthFactor(seed);
  const steps = Math.ceil(STEPS_PER_TILE * curveWidthFactor(seed));
  let d = `M 0 ${yOff}`;
  for (let s = 1; s <= steps; s++) {
    const x = (s / steps) * width;
    const y = yOff + Math.sin((x / size) * Math.PI * seed.freq) * seed.amplitude * size;
    d += ` L ${x} ${y}`;
  }
  return d;
}

function waveSampler(seed: WaveSeed): LayerSampler {
  return (t, size) => {
    const shift = t * travelTiles(seed) * size;
    const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.05;
    return {
      x: (size * curveWidthFactor(seed)) / 2 - shift,
      y: size / 2 - t * size * 0.05,
      rotateDeg: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: alpha,
    };
  };
}

function crestSampler(seed: WaveSeed): DotSampler {
  return (t, size) => {
    const peakX = size * (0.3 + t * 0.4);
    const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.4);
    return { cx: peakX, cy: peakY, r: size * 0.012, opacity: alpha };
  };
}

function spraySampler(seed: WaveSeed): DotSampler {
  return (t, size) => {
    const peakX = size * (0.3 + t * 0.4) + size * 0.03;
    const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size - size * 0.02;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.25);
    return { cx: peakX, cy: peakY, r: size * 0.006, opacity: alpha };
  };
}

function waveArt(seed: WaveSeed): StaticArt {
  return (context, size) => {
    context
      .path(svgPath(wavePath(seed, size)))
      .stroke({ color: 'rgb(60,140,200)', width: size * 0.015, cap: 'round' });
  };
}

const children = WAVE_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'layer',
    sample: waveSampler(seed),
    box: (size) => ({ width: size * curveWidthFactor(seed), height: size }),
    art: waveArt(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
  } satisfies LayerNode,
  {
    kind: 'dot',
    sample: crestSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(180,220,255)',
  },
  {
    kind: 'dot',
    sample: spraySampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(220,240,255)',
  },
]);

export const oceanWaveFlair: DecorationSpec = {
  id: 'oceanWave',
  nodes: [
    {
      kind: 'group',
      place: (size) => ({ left: 0, top: 0, width: size, height: size, scaleX: 1, scaleY: 1 }),
      clip: true,
      children,
    },
  ],
};

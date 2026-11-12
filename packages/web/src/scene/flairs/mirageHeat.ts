/**
 * Mirage Heat: 6 faint heat waves shimmer across the seat. Each wave is a travelling sine, so a
 * static 1.5-tile-wide curve slides left inside a clip to the tile.
 */
import { svgPath } from '@/scene/art';
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 4000;
const WAVE_COUNT = 6;
/** Spatial periods across one tile width. */
const SPATIAL_PERIODS = 2;
/** Curve width as a multiple of tile size; covers the largest translation (0.75 tiles). */
const CURVE_WIDTH_FACTOR = 1.5;
const SEGMENTS_PER_TILE = 6;
const STROKE_COLOR = 'rgb(200,180,140)';

const WAVE_SEEDS = Array.from({ length: WAVE_COUNT }, (_, i) => ({
  yFrac: 0.15 + (i * 0.7) / (WAVE_COUNT - 1),
  amplitude: 0.01 + (i % 3) * 0.005,
  freq: 1 + (i % 2) * 0.5,
  phase: i / WAVE_COUNT,
}));

type WaveSeed = (typeof WAVE_SEEDS)[number];

/** Static wave at `t = 0`, drawn across `CURVE_WIDTH_FACTOR` tiles. */
function wavePath(seed: WaveSeed, size: number): string {
  const baseY = seed.yFrac * size;
  const amp = seed.amplitude * size;
  const segments = SEGMENTS_PER_TILE * CURVE_WIDTH_FACTOR;
  const width = size * CURVE_WIDTH_FACTOR;
  const k = (Math.PI * 2 * SPATIAL_PERIODS) / size;
  let d = `M 0 ${baseY}`;
  for (let i = 1; i <= segments; i += 1) {
    const sx = (i / segments) * width;
    const cpx = ((i - 0.5) / segments) * width;
    d += ` Q ${cpx} ${baseY + Math.sin(k * cpx) * amp * 1.2} ${sx} ${baseY + Math.sin(k * sx) * amp}`;
  }
  return d;
}

/** sin(ωt + kx) travels toward −x by ωt / k; the box centre starts at 0.75 tiles. */
function waveSampler(seed: WaveSeed): LayerSampler {
  return (t, size) => {
    const shift = (t * seed.freq * size) / SPATIAL_PERIODS;
    return {
      x: (size * CURVE_WIDTH_FACTOR) / 2 - shift,
      y: size / 2,
      rotateDeg: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 0.06 + Math.sin(t * Math.PI * 2) * 0.04,
    };
  };
}

function waveArt(seed: WaveSeed): StaticArt {
  return (context, size) => {
    context
      .path(svgPath(wavePath(seed, size)))
      .stroke({ color: STROKE_COLOR, width: size * 0.008, cap: 'round' });
  };
}

const waves = WAVE_SEEDS.map((seed): LayerNode => ({
  kind: 'layer',
  sample: waveSampler(seed),
  box: (size) => ({ width: size * CURVE_WIDTH_FACTOR, height: size }),
  art: waveArt(seed),
  durationMs: LOOP_MS,
  phase: seed.phase,
}));

export const mirageHeatFlair: DecorationSpec = {
  id: 'mirageHeat',
  nodes: [
    {
      kind: 'group',
      place: (size) => ({ left: 0, top: 0, width: size, height: size, scaleX: 1, scaleY: 1 }),
      clip: true,
      children: waves,
    },
  ],
};

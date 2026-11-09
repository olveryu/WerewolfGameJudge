/**
 * Sonic Wave: 5 teal sound-wave rings pulse outward with an 8-lobed jitter. The jitter rotates
 * and the growth is a uniform scale, so each ring is a static wobbly circle at the largest
 * radius inside a layer; the stroke breathing is two copies (thin, thick) cross-faded.
 */
import { svgPath } from '@/scene/art';
import type { DecorationNode, DecorationSpec, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 4000;
const WAVE_COUNT = 5;
const SEGS = 48;
const RAD_TO_DEG = 180 / Math.PI;
const STROKE_COLOR = 'rgb(80,200,180)';
/** Ring radius sweeps `size × 0.12 → size × 0.48` over one wave cycle. */
const R_MIN_FRAC = 0.12;
const R_SPAN_FRAC = 0.36;
/** The static ring is drawn at the largest radius, so the layer scale is ≤ 1. */
const BASE_R_FRAC = R_MIN_FRAC + R_SPAN_FRAC;

const INDICES = Array.from({ length: WAVE_COUNT }, (_, i) => i);

function radiusAt(wt: number, size: number): number {
  return size * R_MIN_FRAC + wt * size * R_SPAN_FRAC;
}

function strokeAt(wt: number): number {
  return 1.5 * (1 - wt * 0.5);
}

/** Static strokes that, times the layer scale, equal the original width at wt = 1 and wt = 0. */
const THIN_STROKE = strokeAt(1) / (radiusAt(1, 1) / BASE_R_FRAC);
const THICK_STROKE = strokeAt(0) / (radiusAt(0, 1) / BASE_R_FRAC);

interface WaveState {
  scale: number;
  rotateDeg: number;
  alpha: number;
  /** Weight of the thick copy so `thin × (1 − w) + thick × w` matches the original width. */
  thickWeight: number;
}

function waveState(t: number, index: number, size: number): WaveState {
  const wt = (t * 1.2 + index / WAVE_COUNT) % 1;
  const radius = radiusAt(wt, size);
  const alpha = (1 - wt) * 0.55;
  const sw = strokeAt(wt);
  const scale = radius / (size * BASE_R_FRAC);
  const thinEff = THIN_STROKE * scale;
  const thickEff = THICK_STROKE * scale;
  const thickWeight = Math.min(1, Math.max(0, (sw - thinEff) / (thickEff - thinEff)));
  return {
    scale,
    rotateDeg: -((t * Math.PI * 12) / 8) * RAD_TO_DEG,
    alpha,
    thickWeight,
  };
}

function createWaveSampler(index: number, weightOf: (state: WaveState) => number): LayerSampler {
  return (t, size) => {
    const state = waveState(t, index, size);
    return {
      x: size / 2,
      y: size / 2,
      rotateDeg: state.rotateDeg,
      scaleX: state.scale,
      scaleY: state.scale,
      opacity: state.alpha * weightOf(state),
    };
  };
}

/** Wobbly ring at `t = 0` and the largest radius, centred on the origin. */
function wavePath(index: number, size: number): string {
  const radius = size * BASE_R_FRAC;
  let d = '';
  for (let s = 0; s <= SEGS; s++) {
    const a = (s / SEGS) * Math.PI * 2;
    const w = 1 + 0.06 * Math.sin(a * 8 + index * 2);
    const x = Math.cos(a) * radius * w;
    const y = Math.sin(a) * radius * w;
    d += s === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  d += ' Z';
  return d;
}

function waveArt(index: number, strokeWidth: number): StaticArt {
  return (context, size) => {
    context
      .path(svgPath(wavePath(index, size)))
      .stroke({ color: STROKE_COLOR, width: strokeWidth });
  };
}

const nodes = INDICES.flatMap((index): DecorationNode[] => [
  {
    kind: 'layer',
    sample: createWaveSampler(index, (state) => 1 - state.thickWeight),
    art: waveArt(index, THIN_STROKE),
    durationMs: LOOP_MS,
  },
  {
    kind: 'layer',
    sample: createWaveSampler(index, (state) => state.thickWeight),
    art: waveArt(index, THICK_STROKE),
    durationMs: LOOP_MS,
  },
]);

export const sonicWaveFlair: DecorationSpec = { id: 'sonicWave', nodes };

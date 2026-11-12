/**
 * Silver Stream: 2 silver streams flow down both top edges with shimmering gleams. The growing,
 * wobbling curve is drawn as cross-faded morph variants.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  MorphArt,
  MorphSampler,
} from '@/scene/decoration';

const LOOP_MS = 4000;
/** Static curves per stream; 8 across a 4 s loop keeps each cross-fade at half a second. */
const STREAM_VARIANTS = 8;
const GLEAM_PER_STREAM = 3;

type StreamSide = 'left' | 'right';

const STREAM_SEEDS: readonly { side: StreamSide; phase: number }[] = [
  { side: 'left', phase: 0 },
  { side: 'right', phase: 0.3 },
];

const GLEAM_SEEDS = Array.from({ length: GLEAM_PER_STREAM }, (_, i) => ({
  idx: i,
  frac: 0.2 + (i / (GLEAM_PER_STREAM - 1)) * 0.6,
}));

function edgeX(side: StreamSide, size: number): number {
  return side === 'left' ? size * 0.08 : size * 0.92;
}

function midX(side: StreamSide, size: number): number {
  return side === 'left' ? size * 0.06 : size * 0.94;
}

function streamPath(side: StreamSide, t: number, size: number): string {
  const xEdge = edgeX(side, size);
  const xMid = midX(side, size);
  const flowLen = t * size * 1.0;
  const y0 = 0;
  const y1 = Math.min(size * 0.35, flowLen);
  const y2 = Math.min(size * 0.7, flowLen);
  const y3 = Math.min(size, flowLen);
  const wobble = Math.sin(t * Math.PI * 4) * size * 0.015;
  return `M ${xEdge} ${y0} Q ${xMid + wobble} ${y1} ${xEdge - wobble} ${y2} Q ${xMid + wobble * 0.5} ${(y2 + y3) / 2} ${xEdge} ${y3}`;
}

const streamSampler: MorphSampler = (t) => {
  const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.25;
  return { opacity: alpha };
};

const STREAM_ARTS: readonly MorphArt[] = STREAM_SEEDS.map((seed) => (context, k, size) => {
  context
    .path(svgPath(streamPath(seed.side, k / STREAM_VARIANTS, size)))
    .stroke({ color: 'rgb(200,210,220)', width: size * 0.012, cap: 'round' });
});

function createGleamSampler(side: StreamSide, idx: number, frac: number): DotSampler {
  return (t, size) => {
    const xEdge = edgeX(side, size);
    const flowLen = t * size * 1.0;
    const gy = frac * flowLen;
    const visible = gy > 0 && gy < size;
    return {
      cx: xEdge + Math.sin(t * Math.PI * 6 + idx) * size * 0.01,
      cy: gy,
      r: size * 0.006,
      opacity: visible ? 0.5 + Math.sin(t * Math.PI * 8 + idx * 2) * 0.3 : 0,
    };
  };
}

const nodes = STREAM_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'morph',
    sample: streamSampler,
    durationMs: LOOP_MS,
    phase: seed.phase,
    variantCount: STREAM_VARIANTS,
    mode: 'crossfade',
    art: STREAM_ARTS[i]!,
  },
  ...GLEAM_SEEDS.map((gleam): DecorationNode => ({
    kind: 'dot',
    sample: createGleamSampler(seed.side, gleam.idx, gleam.frac),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(240,245,255)',
  })),
]);

export const silverStreamFlair: DecorationSpec = { id: 'silverStream', nodes };

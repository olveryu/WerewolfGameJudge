/**
 * Lunar Halo: 3 crescent arcs rotate around the avatar, each with a glow ball at its end. Each
 * arc is static tile-sized art spun about the tile centre by a layer; the glow is a dot.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 6000;
const ARC_COUNT = 3;
const ARC_SPAN = Math.PI * 0.6;

const ARC_SEEDS = Array.from({ length: ARC_COUNT }, (_, i) => ({
  index: i,
  angle0: i * ((Math.PI * 2) / ARC_COUNT),
}));

function arcPulse(t: number, index: number): number {
  return 0.4 + 0.6 * Math.sin((t * 4 + index) * Math.PI);
}

function arcRadius(index: number, size: number): number {
  const orbit = size * 0.42;
  return orbit - index * size * 0.02;
}

/** Static arc at `t = 0` (start angle `angle0`), in tile pixel space. */
function arcPath(index: number, angle: number, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = arcRadius(index, size);
  const sx = cx + Math.cos(angle) * r;
  const sy = cy + Math.sin(angle) * r;
  const ex = cx + Math.cos(angle + ARC_SPAN) * r;
  const ey = cy + Math.sin(angle + ARC_SPAN) * r;
  return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
}

function arcSampler(index: number): LayerSampler {
  return (t, size) => ({
    x: size / 2,
    y: size / 2,
    rotateDeg: t * 360,
    scaleX: 1,
    scaleY: 1,
    opacity: arcPulse(t, index) * 0.5,
  });
}

function glowSampler(index: number): DotSampler {
  return (t, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const angle = t * Math.PI * 2 + index * ((Math.PI * 2) / ARC_COUNT);
    const r = arcRadius(index, size);
    const ex = cx + Math.cos(angle + ARC_SPAN) * r;
    const ey = cy + Math.sin(angle + ARC_SPAN) * r;
    return { cx: ex, cy: ey, r: size * 0.02, opacity: arcPulse(t, index) * 0.7 };
  };
}

function arcArt(index: number, angle0: number): StaticArt {
  return (context, size) => {
    context
      .path(svgPath(arcPath(index, angle0, size)))
      .stroke({ color: 'rgb(180,200,255)', width: 3 - index * 0.5, cap: 'round' });
  };
}

const nodes = ARC_SEEDS.flatMap(({ index, angle0 }): DecorationNode[] => [
  {
    kind: 'layer',
    sample: arcSampler(index),
    box: (size) => ({ width: size, height: size }),
    art: arcArt(index, angle0),
    durationMs: LOOP_MS,
  },
  { kind: 'dot', sample: glowSampler(index), durationMs: LOOP_MS, color: 'rgb(200,220,255)' },
]);

export const lunarHaloFlair: DecorationSpec = { id: 'lunarHalo', nodes };

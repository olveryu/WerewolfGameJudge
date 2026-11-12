/**
 * Light Pillar: four corner pillars rise in turn, each a thin beam, a base spark and a fading
 * glow trail. Each corner pulses for 1.2 s, staggered 1.5 s apart inside an 8 s loop.
 */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const GLOW_STEPS = 4;
const PILLAR_CYCLE = 8000;
const PULSE_DURATION = 1200;
const CORNER_STAGGER = 1500;
const PILLAR_HEIGHT = 0.12;

const CORNERS = [
  { xFrac: 0.08, yFrac: 1, dir: -1 },
  { xFrac: 0.92, yFrac: 1, dir: -1 },
  { xFrac: 0.05, yFrac: 0, dir: 1 },
  { xFrac: 0.95, yFrac: 0, dir: 1 },
] as const;

type Corner = (typeof CORNERS)[number];

function cornerPulse(t: number, cornerIndex: number): number {
  const elapsed = t * PILLAR_CYCLE - cornerIndex * CORNER_STAGGER;
  if (elapsed <= 0 || elapsed >= PULSE_DURATION) return 0;
  return Math.sin((elapsed / PULSE_DURATION) * Math.PI) ** 2;
}

function beamSampler(corner: Corner, cornerIndex: number): LineSampler {
  return (t, size) => {
    const pulse = cornerPulse(t, cornerIndex);
    const height = size * PILLAR_HEIGHT * pulse;
    return {
      x1: corner.xFrac * size,
      y1: corner.yFrac * size,
      x2: corner.xFrac * size,
      y2: corner.yFrac * size + corner.dir * height * 0.8,
      strokeWidth: 1,
      opacity: pulse * 0.45,
    };
  };
}

function sparkSampler(corner: Corner, cornerIndex: number): DotSampler {
  return (t, size) => ({
    cx: corner.xFrac * size,
    cy: corner.yFrac * size,
    r: size * 0.01,
    opacity: cornerPulse(t, cornerIndex) * 0.55,
  });
}

function glowSampler(corner: Corner, cornerIndex: number, step: number): DotSampler {
  const frac = step / GLOW_STEPS;
  return (t, size) => {
    const pulse = cornerPulse(t, cornerIndex);
    const height = size * PILLAR_HEIGHT * pulse;
    return {
      cx: corner.xFrac * size,
      cy: corner.yFrac * size + corner.dir * height * frac,
      r: size * 0.015,
      opacity: (1 - frac) * pulse * 0.1,
    };
  };
}

const nodes = CORNERS.flatMap((corner, cornerIndex): DecorationNode[] => [
  ...Array.from({ length: GLOW_STEPS }, (_, step): DecorationNode => ({
    kind: 'dot',
    sample: glowSampler(corner, cornerIndex, step),
    durationMs: PILLAR_CYCLE,
    color: 'rgb(255,230,130)',
  })),
  {
    kind: 'line',
    sample: beamSampler(corner, cornerIndex),
    durationMs: PILLAR_CYCLE,
    color: 'rgb(255,240,180)',
  },
  {
    kind: 'dot',
    sample: sparkSampler(corner, cornerIndex),
    durationMs: PILLAR_CYCLE,
    color: 'rgb(255,245,200)',
  },
]);

export const lightPillarFlair: DecorationSpec = { id: 'lightPillar', nodes };

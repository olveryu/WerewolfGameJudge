/** Aura Burst: 3 concentric ring pairs expand from the centre in turn and fade at the edge. */
import type { DecorationNode, DecorationSpec, RingSampler } from '@/scene/decoration';

const LOOP_MS = 4000;
const RING_COUNT = 3;
const COLORS = ['rgb(160,120,255)', 'rgb(120,180,255)', 'rgb(180,100,255)'] as const;

function ringAlpha(t: number): number {
  return t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
}

const outerSampler: RingSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: t * size * 0.55,
  strokeWidth: size * 0.015,
  opacity: ringAlpha(t) * 0.2,
});

const innerSampler: RingSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: t * size * 0.5,
  strokeWidth: size * 0.006,
  opacity: ringAlpha(t) * 0.4,
});

const nodes = Array.from({ length: RING_COUNT }, (_, i): DecorationNode[] => [
  {
    kind: 'ring',
    sample: outerSampler,
    durationMs: LOOP_MS,
    phase: i / RING_COUNT,
    color: COLORS[i % COLORS.length]!,
  },
  {
    kind: 'ring',
    sample: innerSampler,
    durationMs: LOOP_MS,
    phase: i / RING_COUNT,
    color: 'rgb(220,210,255)',
  },
]).flat();

export const auraBurstFlair: DecorationSpec = { id: 'auraBurst', nodes };

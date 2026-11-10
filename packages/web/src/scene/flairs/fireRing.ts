/**
 * Blazing Ring: 8 flames orbit the avatar edge, each a head dot with a fading 3-dot trail.
 * Ported from the RN client's `FireRingFlair` samplers.
 */
import type { DecorationSpec, DotNode, DotSampler } from '@/scene/decoration';

const LOOP_MS = 3000;
const TRAIL_LENGTH = 3;
const FLAME_COLORS = [
  0xdc2800, 0xf07800, 0xffb41e, 0xdc3c00, 0xf0640a, 0xffa014, 0xc81e00, 0xf08c00,
] as const;

/** Trail dots render back to front (`TRAIL_LENGTH … 0`) so the head is drawn last. */
const TRAIL_INDICES = Array.from({ length: TRAIL_LENGTH + 1 }, (_, i) => TRAIL_LENGTH - i);

const TRAIL_SAMPLERS: readonly DotSampler[] = TRAIL_INDICES.map((trailIndex) => (t, size) => {
  const centre = size / 2;
  const orbit = size * 0.42;
  const radius = size * 0.02;
  const angle = t * Math.PI * 2 - trailIndex * 0.08;
  const alphaScale = trailIndex === 0 ? 1 : (1 - trailIndex / (TRAIL_LENGTH + 1)) * 0.5;
  const radiusScale = trailIndex === 0 ? 1 : 1 - trailIndex * 0.2;
  return {
    cx: centre + Math.cos(angle) * orbit,
    cy: centre + Math.sin(angle) * orbit,
    r: radius * radiusScale,
    opacity: alphaScale * 0.75,
  };
});

/** One flame per colour; flame `index` only shifts the orbit by `index / 8` of the loop (`phase`). */
const nodes: DotNode[] = FLAME_COLORS.flatMap((color, flameIndex) =>
  TRAIL_SAMPLERS.map(
    (sample): DotNode => ({
      kind: 'dot',
      sample,
      durationMs: LOOP_MS,
      phase: flameIndex / FLAME_COLORS.length,
      color,
    }),
  ),
);

export const fireRingFlair: DecorationSpec = { id: 'fireRing', nodes };

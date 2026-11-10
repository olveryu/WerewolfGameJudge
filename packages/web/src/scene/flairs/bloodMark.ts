/**
 * Blood Mark: 4 dark-red drops fall from the top with stretched trails that fade at the bottom.
 * Drop and trail fall together, so each drop is rigid art moved by one layer.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 3500;
const N = 4;
const TRAIL_LEN = 3;
/** Layer centre sits this many radii above the drop centre so the group is centred. */
const CENTRE_LIFT = 2;

const DROP_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.2 + (i * 0.6) / (N - 1),
  phase: i / N,
  rFrac: 0.018 + (i % 2) * 0.006,
}));

/** Trails drawn farthest first so the main drop stacks on top. */
const TRAIL_INDICES = Array.from({ length: TRAIL_LEN }, (_, k) => TRAIL_LEN - k);

const DROP_SAMPLERS: readonly LayerSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const x = seed.xFrac * size;
  const y = t * size;
  const r = seed.rFrac * size;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
  return { x, y: y - r * CENTRE_LIFT, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

const DROP_ARTS: readonly StaticArt[] = DROP_SEEDS.map((seed) => (context, size) => {
  const r = seed.rFrac * size;
  const mainCy = r * CENTRE_LIFT;
  for (const k of TRAIL_INDICES) {
    context
      .circle(0, mainCy - k * r * 1.5, r * (1 - k * 0.15))
      .fill({ color: 'rgb(140,10,10)', alpha: (1 - k / (TRAIL_LEN + 1)) * 0.6 });
  }
  context.circle(0, mainCy, r).fill('rgb(180,20,20)');
});

const nodes = DROP_SEEDS.map(
  (seed, i): LayerNode => ({
    kind: 'layer',
    sample: DROP_SAMPLERS[i]!,
    art: DROP_ARTS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
  }),
);

export const bloodMarkFlair: DecorationSpec = { id: 'bloodMark', nodes };

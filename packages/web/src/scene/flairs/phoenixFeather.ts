/** Phoenix Feather: 8 glowing feathers spiral upward from around the avatar and fade. */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 8;
const RAD_TO_DEG = 180 / Math.PI;

const FEATHER_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2,
  phase: i / N,
  dist: 0.25 + (i % 3) * 0.08,
}));

const FEATHER_SAMPLERS: readonly LayerSampler[] = FEATHER_SEEDS.map((seed) => (tt, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const spiralAngle = seed.angle + tt * Math.PI * 4;
  const dist = (seed.dist + tt * 0.2) * size;
  const y0 = cy - tt * size * 0.3;
  const x0 = cx + Math.cos(spiralAngle) * dist * 0.3;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;
  const ang = spiralAngle + Math.PI / 2;
  return { x: x0, y: y0, rotateDeg: ang * RAD_TO_DEG, scaleX: 1, scaleY: 1, opacity: alpha };
});

/** Feather centred on the origin: a horizontal line over a glow disc. */
const featherArt: StaticArt = (context, size) => {
  const featherLen = size * 0.035;
  context
    .moveTo(-featherLen, 0)
    .lineTo(featherLen, 0)
    .stroke({ color: 'rgb(255,160,30)', width: 2, alpha: 0.8 });
  context.circle(0, 0, size * 0.025).fill({ color: 'rgb(255,100,20)', alpha: 0.3 });
};

const nodes = FEATHER_SEEDS.map(
  (seed, i): LayerNode => ({
    kind: 'layer',
    sample: FEATHER_SAMPLERS[i]!,
    art: featherArt,
    durationMs: LOOP_MS,
    phase: seed.phase,
  }),
);

export const phoenixFeatherFlair: DecorationSpec = { id: 'phoenixFeather', nodes };

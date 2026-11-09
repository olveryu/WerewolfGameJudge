/**
 * Starlight: 6 four-pointed stars orbit the avatar with rays, a glow halo and a centre dot. The
 * orbit uses the raw loop progress and the twinkle the phased one, so the phase stays in the
 * sampler.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 6;
const ARM_LEN_FRAC = 0.05;

const STAR_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.35 + (i % 3) * 0.05,
  phase: i / N,
  drift: 0.4 + (i % 4) * 0.25,
}));

const STAR_SAMPLERS: readonly LayerSampler[] = STAR_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + t * Math.PI * 2 * seed.drift;
  const d = seed.dist * size;
  const x = cx + Math.cos(angle) * d;
  const y = cy + Math.sin(angle) * d;
  const pt = (t + seed.phase) % 1;
  const tw = 0.3 + 0.7 * Math.max(0, Math.sin(pt * Math.PI * 2));
  return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: tw };
});

/** Star centred on the origin. */
const starArt: StaticArt = (context, size) => {
  const armLen = size * ARM_LEN_FRAC;
  const diagLen = armLen * 0.55;
  context.circle(0, 0, armLen * 0.9).fill({ color: 'rgb(255,250,200)', alpha: 0.15 });
  context
    .moveTo(-armLen, 0)
    .lineTo(armLen, 0)
    .moveTo(0, -armLen)
    .lineTo(0, armLen)
    .stroke({ color: 'rgb(255,253,224)', width: 1.5, alpha: 0.8 });
  context
    .moveTo(-diagLen, -diagLen)
    .lineTo(diagLen, diagLen)
    .moveTo(-diagLen, diagLen)
    .lineTo(diagLen, -diagLen)
    .stroke({ color: 'rgb(255,253,224)', width: 1, alpha: 0.5 });
  context.circle(0, 0, size * 0.008).fill({ color: 'rgb(255,255,240)', alpha: 0.9 });
};

const nodes = STAR_SAMPLERS.map(
  (sample): LayerNode => ({ kind: 'layer', sample, art: starArt, durationMs: LOOP_MS }),
);

export const starlightFlair: DecorationSpec = { id: 'starlight', nodes };

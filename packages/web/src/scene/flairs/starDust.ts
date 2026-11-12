/**
 * Star Dust: 7 tiny cross-stars twinkle around the perimeter. Every element of a star shares one
 * envelope, so each star is static art faded by a layer.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const STAR_COUNT = 7;

const STAR_SEEDS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  xFrac: 0.1 + (((i * 17 + 3) % 11) / 12) * 0.8,
  yFrac: 0.1 + (((i * 13 + 5) % 9) / 10) * 0.8,
  phase: i / STAR_COUNT,
  armLen: 0.025 + (i % 3) * 0.008,
}));

type StarSeed = (typeof STAR_SEEDS)[number];

function getAlpha(cycle: number): number {
  if (cycle < 0.2) return cycle / 0.2;
  if (cycle < 0.4) return 1;
  if (cycle < 0.6) return 1 - (cycle - 0.4) / 0.2;
  return 0;
}

function starSampler(seed: StarSeed): LayerSampler {
  return (t, size) => ({
    x: seed.xFrac * size,
    y: seed.yFrac * size,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: getAlpha(t),
  });
}

/** Star centred on the origin. */
function starArt(seed: StarSeed): StaticArt {
  return (context, size) => {
    const arm = seed.armLen * size;
    const da = arm * 0.6;
    context
      .moveTo(-arm, 0)
      .lineTo(arm, 0)
      .moveTo(0, -arm)
      .lineTo(0, arm)
      .stroke({ color: 'rgb(255,255,220)', width: size * 0.006, alpha: 0.5 });
    context
      .moveTo(-da, -da)
      .lineTo(da, da)
      .moveTo(da, -da)
      .lineTo(-da, da)
      .stroke({ color: 'rgb(220,220,255)', width: size * 0.004, alpha: 0.3 });
    context.circle(0, 0, size * 0.008).fill({ color: 'rgb(255,255,255)', alpha: 0.8 });
  };
}

const nodes = STAR_SEEDS.map((seed): LayerNode => ({
  kind: 'layer',
  sample: starSampler(seed),
  art: starArt(seed),
  durationMs: LOOP_MS,
  phase: seed.phase,
}));

export const starDustFlair: DecorationSpec = { id: 'starDust', nodes };

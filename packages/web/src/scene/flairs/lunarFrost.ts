/**
 * Lunar Frost: 4 six-armed ice crystals slowly turn and fade over the avatar. Arms and branches
 * are rigid line groups spun by layers (one per opacity envelope); the centre glint is a dot.
 */
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 6000;
const ARMS_PER_CRYSTAL = 6;
const ARM_STROKE_FRAC = 0.003;
const BRANCH_STROKE_FRAC = 0.002;

const CRYSTAL_SEEDS = [
  { cx: 0.2, cy: 0.2, armLen: 0.08, rotSpeed: 0.3, phase: 0 },
  { cx: 0.8, cy: 0.25, armLen: 0.06, rotSpeed: -0.2, phase: 0.25 },
  { cx: 0.3, cy: 0.8, armLen: 0.07, rotSpeed: 0.25, phase: 0.5 },
  { cx: 0.75, cy: 0.75, armLen: 0.09, rotSpeed: -0.35, phase: 0.75 },
] as const;

type CrystalSeed = (typeof CRYSTAL_SEEDS)[number];

const ARM_INDICES = Array.from({ length: ARMS_PER_CRYSTAL }, (_, i) => i);

function createCrystalSampler(seed: CrystalSeed, alphaOf: (t: number) => number): LayerSampler {
  return (t, size) => {
    const rot = t * Math.PI * 2 * seed.rotSpeed;
    return {
      x: seed.cx * size,
      y: seed.cy * size,
      rotateDeg: (rot * 180) / Math.PI,
      scaleX: 1,
      scaleY: 1,
      opacity: alphaOf(t),
    };
  };
}

function centerSampler(seed: CrystalSeed): DotSampler {
  return (t, size) => {
    const alpha = 0.3 + Math.sin(t * Math.PI * 2) * 0.2;
    return { cx: seed.cx * size, cy: seed.cy * size, r: size * 0.008, opacity: alpha };
  };
}

/** Six arms at `rot = 0`, centred on the origin. */
function armsArt(seed: CrystalSeed): StaticArt {
  return (context, size) => {
    const len = seed.armLen * size;
    for (const ai of ARM_INDICES) {
      const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2;
      context.moveTo(0, 0).lineTo(Math.cos(baseAngle) * len, Math.sin(baseAngle) * len);
    }
    context.stroke({ color: 'rgb(180,210,240)', width: size * ARM_STROKE_FRAC, cap: 'round' });
  };
}

/** One 45° side branch per arm at `rot = 0`, centred on the origin. */
function branchesArt(seed: CrystalSeed): StaticArt {
  return (context, size) => {
    const len = seed.armLen * size;
    for (const ai of ARM_INDICES) {
      const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2;
      const midX = Math.cos(baseAngle) * len * 0.6;
      const midY = Math.sin(baseAngle) * len * 0.6;
      const branchAngle = baseAngle + Math.PI / 4;
      const branchLen = len * 0.3;
      context
        .moveTo(midX, midY)
        .lineTo(midX + Math.cos(branchAngle) * branchLen, midY + Math.sin(branchAngle) * branchLen);
    }
    context.stroke({ color: 'rgb(200,225,250)', width: size * BRANCH_STROKE_FRAC, cap: 'round' });
  };
}

const nodes = CRYSTAL_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'layer',
    sample: createCrystalSampler(seed, (t) => 0.2 + Math.sin(t * Math.PI * 2) * 0.15),
    art: armsArt(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'layer',
    sample: createCrystalSampler(seed, (t) => 0.15 + Math.sin(t * Math.PI * 2) * 0.1),
    art: branchesArt(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'dot',
    sample: centerSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(220,240,255)',
  },
]);

export const lunarFrostFlair: DecorationSpec = { id: 'lunarFrost', nodes };

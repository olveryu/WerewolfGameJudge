/**
 * Coral Glow: 4 branched corals (static Y forks) grow from the bottom with fluorescent pulses.
 * Trunk and forks share one pulse, so each branch is art faded by one layer; the tip glow has
 * its own envelope and is a dot.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 4000;
const BRANCH_COUNT = 4;
const COLORS = [
  [255, 120, 100],
  [255, 160, 80],
  [255, 100, 120],
  [255, 140, 100],
] as const;

const BRANCH_SEEDS = Array.from({ length: BRANCH_COUNT }, (_, i) => ({
  xBase: 0.2 + (i * 0.6) / (BRANCH_COUNT - 1),
  phase: i / BRANCH_COUNT,
  ci: i % COLORS.length,
}));

type BranchSeed = (typeof BRANCH_SEEDS)[number];

function trunkPath(seed: BranchSeed, size: number): string {
  const bx = seed.xBase * size;
  const by = size * 0.95;
  const ty = by - size * 0.35;
  return `M ${bx} ${by} L ${bx} ${ty}`;
}

function leftPath(seed: BranchSeed, size: number): string {
  const bx = seed.xBase * size;
  const forkY = size * 0.95 - size * 0.2;
  const tipX = bx - size * 0.06;
  const tipY = forkY - size * 0.12;
  return `M ${bx} ${forkY} Q ${bx - size * 0.03} ${forkY - size * 0.06} ${tipX} ${tipY}`;
}

function rightPath(seed: BranchSeed, size: number): string {
  const bx = seed.xBase * size;
  const forkY = size * 0.95 - size * 0.15;
  const tipX = bx + size * 0.05;
  const tipY = forkY - size * 0.1;
  return `M ${bx} ${forkY} Q ${bx + size * 0.03} ${forkY - size * 0.05} ${tipX} ${tipY}`;
}

/** Shared pulse of trunk and forks; the per-path factors live on the static art. */
const branchSampler: LayerSampler = (t, size) => {
  const pulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
  return { x: size / 2, y: size / 2, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: pulse };
};

const TIP_GLOW_SAMPLERS: readonly DotSampler[] = BRANCH_SEEDS.map((seed) => (t, size) => {
  const pulse = Math.max(0, Math.sin(t * Math.PI * 3) * 0.6);
  const bx = seed.xBase * size;
  const tipY = size * 0.95 - size * 0.35;
  return { cx: bx, cy: tipY, r: size * 0.015, opacity: pulse };
});

function colorOf(seed: BranchSeed, lift = 0): string {
  const [cr, cg, cb] = COLORS[seed.ci]!;
  return `rgb(${Math.min(255, cr + lift)},${Math.min(255, cg + lift)},${Math.min(255, cb + lift)})`;
}

const BRANCH_ARTS: readonly StaticArt[] = BRANCH_SEEDS.map((seed) => (context, size) => {
  const color = colorOf(seed);
  context
    .path(svgPath(trunkPath(seed, size)))
    .stroke({ color, width: size * 0.012, alpha: 0.4, cap: 'round' });
  context
    .path(svgPath(leftPath(seed, size)))
    .stroke({ color, width: size * 0.008, alpha: 0.35, cap: 'round' });
  context
    .path(svgPath(rightPath(seed, size)))
    .stroke({ color, width: size * 0.008, alpha: 0.35, cap: 'round' });
});

const nodes = BRANCH_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'layer',
    sample: branchSampler,
    box: (size) => ({ width: size, height: size }),
    art: BRANCH_ARTS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'dot',
    sample: TIP_GLOW_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: colorOf(seed, 60),
  },
]);

export const coralGlowFlair: DecorationSpec = { id: 'coralGlow', nodes };

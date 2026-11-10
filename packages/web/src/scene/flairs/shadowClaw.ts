/** Shadow Claw: 4 sets of three purple claw marks slash inward from the corners with tip sparks. */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const LOOP_MS = 3500;
const SCRATCH_COUNT = 3;

/** Corner origins as tile fractions; `ci` is the per-corner pulse offset index. */
const CLAW_SEEDS = [
  { oxFrac: 0.05, oyFrac: 0.05, dx: 1, dy: 1, ci: 0 },
  { oxFrac: 0.95, oyFrac: 0.05, dx: -1, dy: 1, ci: 1 },
  { oxFrac: 0.05, oyFrac: 0.95, dx: 1, dy: -1, ci: 2 },
  { oxFrac: 0.95, oyFrac: 0.95, dx: -1, dy: -1, ci: 3 },
] as const;

type ClawSeed = (typeof CLAW_SEEDS)[number];

function clawPulse(t: number, seed: ClawSeed): number {
  return 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + seed.ci * 0.8) * Math.PI));
}

function scratchSampler(seed: ClawSeed, k: number): LineSampler {
  return (t, size) => {
    const pulse = clawPulse(t, seed);
    const offset = (k - 1) * size * 0.03;
    const sx = seed.oxFrac * size + seed.dy * offset;
    const sy = seed.oyFrac * size + -seed.dx * offset;
    const len = size * 0.18 * pulse;
    const ex = sx + seed.dx * len;
    const ey = sy + seed.dy * len;
    return {
      x1: sx,
      y1: sy,
      x2: ex,
      y2: ey,
      opacity: pulse * (0.6 - k * 0.1),
      strokeWidth: 2 - k * 0.4,
    };
  };
}

function sparkSampler(seed: ClawSeed): DotSampler {
  return (t, size) => {
    const pulse = clawPulse(t, seed);
    const tipX = seed.oxFrac * size + seed.dx * size * 0.18 * pulse;
    const tipY = seed.oyFrac * size + seed.dy * size * 0.18 * pulse;
    return { cx: tipX, cy: tipY, r: size * 0.012, opacity: pulse * 0.6 };
  };
}

const nodes = CLAW_SEEDS.flatMap((seed): DecorationNode[] => [
  ...Array.from(
    { length: SCRATCH_COUNT },
    (_, k): DecorationNode => ({
      kind: 'line',
      sample: scratchSampler(seed, k),
      durationMs: LOOP_MS,
      color: 'rgb(120,40,160)',
    }),
  ),
  { kind: 'dot', sample: sparkSampler(seed), durationMs: LOOP_MS, color: 'rgb(180,100,220)' },
]);

export const shadowClawFlair: DecorationSpec = { id: 'shadowClaw', nodes };

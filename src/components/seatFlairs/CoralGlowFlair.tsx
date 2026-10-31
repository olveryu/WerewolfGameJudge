/**
 * CoralGlowFlair — Coral Glow
 *
 * 4 branched coral shapes (static Y-fork paths) growing from the bottom with fluorescent pulses.
 * Trunk and forks share one pulse envelope, so each branch is a static SVG faded by one LoopLayer
 * with static per-path opacity factors; the tip glow has its own envelope and is a LoopDot.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

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

/** Shared pulse of trunk + forks; the per-path `0.4` / `0.35` factors live on the static paths. */
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

export const CoralGlowFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BRANCH_SEEDS.map((seed, i) => {
      const [cr, cg, cb] = COLORS[seed.ci]!;
      const color = `rgb(${cr},${cg},${cb})`;
      return (
        <Fragment key={`branch-${seed.xBase}`}>
          <LoopLayer
            sample={branchSampler}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={size}
            height={size}
          >
            <Svg width={size} height={size}>
              <Path
                d={trunkPath(seed, size)}
                stroke={color}
                strokeWidth={size * 0.012}
                opacity={0.4}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={leftPath(seed, size)}
                stroke={color}
                strokeWidth={size * 0.008}
                opacity={0.35}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={rightPath(seed, size)}
                stroke={color}
                strokeWidth={size * 0.008}
                opacity={0.35}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </LoopLayer>
          <LoopDot
            sample={TIP_GLOW_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={`rgb(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)})`}
          />
        </Fragment>
      );
    })}
  </View>
));
CoralGlowFlair.displayName = 'CoralGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

/**
 * LunarFrostFlair — lunar frost condensation
 *
 * 4 six-armed ice crystals slowly rotate + fade in/out over the avatar area. Each crystal's arms
 * and branches are rigid line groups, so they are two static SVGs spun by LoopLayer (one per
 * opacity envelope); the centre glint is a LoopDot.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

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

/** Layer box: arm diameter plus one arm stroke of margin for the round caps. */
function crystalBox(seed: CrystalSeed, size: number): number {
  return 2 * seed.armLen * size + size * ARM_STROKE_FRAC;
}

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

const ARM_SAMPLERS: readonly LayerSampler[] = CRYSTAL_SEEDS.map((seed) =>
  createCrystalSampler(seed, (t) => 0.2 + Math.sin(t * Math.PI * 2) * 0.15),
);

const BRANCH_SAMPLERS: readonly LayerSampler[] = CRYSTAL_SEEDS.map((seed) =>
  createCrystalSampler(seed, (t) => 0.15 + Math.sin(t * Math.PI * 2) * 0.1),
);

const CENTER_SAMPLERS: readonly DotSampler[] = CRYSTAL_SEEDS.map((seed) => (t, size) => {
  const alpha = 0.3 + Math.sin(t * Math.PI * 2) * 0.2;
  return { cx: seed.cx * size, cy: seed.cy * size, r: size * 0.008, opacity: alpha };
});

/** Six arms at `rot = 0`, centred on the origin. */
function CrystalArms({ seed, size }: { seed: CrystalSeed; size: number }) {
  const box = crystalBox(seed, size);
  const half = box / 2;
  const len = seed.armLen * size;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      {ARM_INDICES.map((ai) => {
        const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2;
        return (
          <Line
            key={`arm-${baseAngle}`}
            x1={0}
            y1={0}
            x2={Math.cos(baseAngle) * len}
            y2={Math.sin(baseAngle) * len}
            stroke="rgb(180,210,240)"
            strokeWidth={size * ARM_STROKE_FRAC}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

/** One 45° side branch per arm at `rot = 0`, centred on the origin. */
function CrystalBranches({ seed, size }: { seed: CrystalSeed; size: number }) {
  const box = crystalBox(seed, size);
  const half = box / 2;
  const len = seed.armLen * size;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      {ARM_INDICES.map((ai) => {
        const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2;
        const midX = Math.cos(baseAngle) * len * 0.6;
        const midY = Math.sin(baseAngle) * len * 0.6;
        const branchAngle = baseAngle + Math.PI / 4;
        const branchLen = len * 0.3;
        return (
          <Line
            key={`branch-${baseAngle}`}
            x1={midX}
            y1={midY}
            x2={midX + Math.cos(branchAngle) * branchLen}
            y2={midY + Math.sin(branchAngle) * branchLen}
            stroke="rgb(200,225,250)"
            strokeWidth={size * BRANCH_STROKE_FRAC}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

export const LunarFrostFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {CRYSTAL_SEEDS.map((seed, i) => {
      const box = crystalBox(seed, size);
      return (
        <Fragment key={`crystal-${seed.cx}-${seed.cy}`}>
          <LoopLayer
            sample={ARM_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={box}
            height={box}
          >
            <CrystalArms seed={seed} size={size} />
          </LoopLayer>
          <LoopLayer
            sample={BRANCH_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={box}
            height={box}
          >
            <CrystalBranches seed={seed} size={size} />
          </LoopLayer>
          <LoopDot
            sample={CENTER_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(220,240,255)"
          />
        </Fragment>
      );
    })}
  </View>
));
LunarFrostFlair.displayName = 'LunarFrostFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

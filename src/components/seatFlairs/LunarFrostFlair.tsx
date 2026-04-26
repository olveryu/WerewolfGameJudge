/**
 * LunarFrostFlair — 月霜凝结
 *
 * 4 朵六臂冰晶在头像区域缓慢旋转 + 渐现渐隐，AnimatedLine 绘制对称臂。
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const ARMS_PER_CRYSTAL = 6;

interface CrystalSeed {
  cx: number;
  cy: number;
  armLen: number;
  rotSpeed: number;
  phase: number;
}

/** Single arm + branch pair extracted so hooks are at component scope */
const CrystalArm = memo<{
  ai: number;
  seed: CrystalSeed;
  size: number;
  cx: number;
  cy: number;
  progress: { value: number };
}>(({ ai, seed, size, cx, cy, progress }) => {
  const armProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const rot = t * Math.PI * 2 * seed.rotSpeed;
    const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2 + rot;
    const len = seed.armLen * size;
    const alpha = 0.2 + Math.sin(t * Math.PI * 2) * 0.15;
    return {
      x1: cx,
      y1: cy,
      x2: cx + Math.cos(baseAngle) * len,
      y2: cy + Math.sin(baseAngle) * len,
      opacity: alpha,
      strokeWidth: size * 0.003,
    } as Record<string, number>;
  });

  const branchProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const rot = t * Math.PI * 2 * seed.rotSpeed;
    const baseAngle = (ai / ARMS_PER_CRYSTAL) * Math.PI * 2 + rot;
    const len = seed.armLen * size;
    const midX = cx + Math.cos(baseAngle) * len * 0.6;
    const midY = cy + Math.sin(baseAngle) * len * 0.6;
    const branchAngle = baseAngle + Math.PI / 4;
    const branchLen = len * 0.3;
    const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.1;
    return {
      x1: midX,
      y1: midY,
      x2: midX + Math.cos(branchAngle) * branchLen,
      y2: midY + Math.sin(branchAngle) * branchLen,
      opacity: alpha,
      strokeWidth: size * 0.002,
    } as Record<string, number>;
  });

  return (
    <>
      <AnimatedLine animatedProps={armProps} stroke="rgb(180,210,240)" strokeLinecap="round" />
      <AnimatedLine animatedProps={branchProps} stroke="rgb(200,225,250)" strokeLinecap="round" />
    </>
  );
});
CrystalArm.displayName = 'CrystalArm';

/** Center glint extracted so hook is at component scope */
const CrystalCenter = memo<{
  seed: CrystalSeed;
  size: number;
  cx: number;
  cy: number;
  progress: { value: number };
}>(({ seed, size, cx, cy, progress }) => {
  const centerProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const alpha = 0.3 + Math.sin(t * Math.PI * 2) * 0.2;
    return { cx, cy, r: size * 0.008, opacity: alpha } as Record<string, number>;
  });
  return <AnimatedCircle animatedProps={centerProps} fill="rgb(220,240,255)" />;
});
CrystalCenter.displayName = 'CrystalCenter';

const IceCrystal = memo<{ seed: CrystalSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = seed.cx * size;
    const cy = seed.cy * size;
    const arms = useMemo(() => Array.from({ length: ARMS_PER_CRYSTAL }, (_, i) => i), []);

    return (
      <>
        {arms.map((ai) => (
          <CrystalArm
            key={ai}
            ai={ai}
            seed={seed}
            size={size}
            cx={cx}
            cy={cy}
            progress={progress}
          />
        ))}
        <CrystalCenter seed={seed} size={size} cx={cx} cy={cy} progress={progress} />
      </>
    );
  },
);
IceCrystal.displayName = 'IceCrystal';

export const LunarFrostFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo<CrystalSeed[]>(
    () => [
      { cx: 0.2, cy: 0.2, armLen: 0.08, rotSpeed: 0.3, phase: 0 },
      { cx: 0.8, cy: 0.25, armLen: 0.06, rotSpeed: -0.2, phase: 0.25 },
      { cx: 0.3, cy: 0.8, armLen: 0.07, rotSpeed: 0.25, phase: 0.5 },
      { cx: 0.75, cy: 0.75, armLen: 0.09, rotSpeed: -0.35, phase: 0.75 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <IceCrystal key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
LunarFrostFlair.displayName = 'LunarFrostFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

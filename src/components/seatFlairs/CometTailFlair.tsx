/**
 * CometTailFlair — 彗星拖尾
 *
 * 3 颗彗星在外围环绕，每颗带 8 节渐隐拖尾。
 * react-native-svg + Reanimated useAnimatedProps。
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
import { AnimatedCircle } from './svgAnimatedPrimitives';

const COMET_COUNT = 3;
const TRAIL_LEN = 8;

interface CometSeed {
  angle0: number;
  phase: number;
  speed: number;
}

const TrailDot = memo<{ j: number; seed: CometSeed; size: number; progress: { value: number } }>(
  ({ j, seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.4;

    const dotProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = seed.angle0 + t * seed.speed * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin((t * 4 + seed.phase * 6) * Math.PI);
      const ta = angle - j * 0.12;
      const td = orbit + j * 1;
      const tx = cx + Math.cos(ta) * td;
      const ty = cy + Math.sin(ta) * td;
      const r = j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
      const alpha = j === 0 ? pulse * 0.85 : Math.max(0, pulse * (0.5 - j * 0.05));
      return { cx: tx, cy: ty, r, opacity: alpha } as Record<string, number>;
    });

    return <AnimatedCircle animatedProps={dotProps} fill="rgb(180,200,255)" />;
  },
);
TrailDot.displayName = 'TrailDot';

const HeadGlow = memo<{ seed: CometSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.4;

    const glowProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = seed.angle0 + t * seed.speed * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin((t * 4 + seed.phase * 6) * Math.PI);
      const headX = cx + Math.cos(angle) * orbit;
      const headY = cy + Math.sin(angle) * orbit;
      return { cx: headX, cy: headY, r: size * 0.03, opacity: pulse * 0.3 } as Record<
        string,
        number
      >;
    });

    return <AnimatedCircle animatedProps={glowProps} fill="rgb(220,235,255)" />;
  },
);
HeadGlow.displayName = 'HeadGlow';

const TRAIL_INDICES = Array.from({ length: TRAIL_LEN + 1 }, (_, j) => j);

const CometParticle = memo<{ seed: CometSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => (
    <>
      {TRAIL_INDICES.map((j) => (
        <TrailDot key={j} j={j} seed={seed} size={size} progress={progress} />
      ))}
      <HeadGlow seed={seed} size={size} progress={progress} />
    </>
  ),
);
CometParticle.displayName = 'CometParticle';

export const CometTailFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: COMET_COUNT }, (_, i) => ({
        angle0: (i / COMET_COUNT) * Math.PI * 2,
        phase: i / COMET_COUNT,
        speed: 0.5 + i * 0.15,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <CometParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
CometTailFlair.displayName = 'CometTailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

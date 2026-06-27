/**
 * GhostWispFlair — Ghost Wisps
 *
 * 5 blue-white ghost wisps drift erratically around the perimeter, each with a 3-segment trail and glow halo.
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const N = 5;

interface WispSeed {
  angle: number;
  phase: number;
  orbitR: number;
}

const WispParticle = memo<{
  seed: WispSeed;
  size: number;
  progress: { value: number };
  index: number;
}>(({ seed, size, progress }) => {
  const glowProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
    const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
    return { cx: x, cy: y, r: size * 0.04, opacity: pulse * 0.25 };
  });

  const coreProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
    const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
    return { cx: x, cy: y, r: size * 0.018, opacity: pulse * 0.9 };
  });

  const tail1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
    const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
    const ta = angle - 1 * 0.15;
    const td = dist - 1 * 2;
    return {
      cx: cx + Math.cos(ta) * td,
      cy: cy + Math.sin(ta) * td,
      r: size * 0.011,
      opacity: Math.max(0, pulse * 0.3),
    };
  });

  const tail2Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
    const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
    const ta = angle - 2 * 0.15;
    const td = dist - 2 * 2;
    return {
      cx: cx + Math.cos(ta) * td,
      cy: cy + Math.sin(ta) * td,
      r: size * 0.008,
      opacity: Math.max(0, pulse * 0.2),
    };
  });

  const tail3Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
    const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
    const ta = angle - 3 * 0.15;
    const td = dist - 3 * 2;
    return {
      cx: cx + Math.cos(ta) * td,
      cy: cy + Math.sin(ta) * td,
      r: size * 0.005,
      opacity: Math.max(0, pulse * 0.1),
    };
  });

  return (
    <>
      <AnimatedCircle animatedProps={glowProps} fill="rgb(100,200,255)" />
      <AnimatedCircle animatedProps={coreProps} fill="rgb(180,230,255)" />
      <AnimatedCircle animatedProps={tail1Props} fill="rgb(100,200,255)" />
      <AnimatedCircle animatedProps={tail2Props} fill="rgb(100,200,255)" />
      <AnimatedCircle animatedProps={tail3Props} fill="rgb(100,200,255)" />
    </>
  );
});
WispParticle.displayName = 'WispParticle';

export const GhostWispFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(5000);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2,
        phase: i / N,
        orbitR: 0.3 + (i % 3) * 0.06,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <WispParticle key={i} seed={s} size={size} progress={progress} index={i} />
        ))}
      </Svg>
    </View>
  );
});
GhostWispFlair.displayName = 'GhostWispFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

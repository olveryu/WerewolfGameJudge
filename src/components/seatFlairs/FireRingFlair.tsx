/**
 * FireRingFlair — Blazing Ring
 *
 * 8 flame particles orbit along the avatar edge with red→orange→yellow gradient and trails.
 * react-native-svg + Reanimated useAnimatedProps.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { LegendaryAura } from './legendaryEffects';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const N = 8;
const TRAIL = 3;
const COLORS = [
  [220, 40, 0],
  [240, 120, 0],
  [255, 180, 30],
  [220, 60, 0],
  [240, 100, 10],
  [255, 160, 20],
  [200, 30, 0],
  [240, 140, 0],
] as const;

interface FireTrailProps {
  index: number;
  trailIndex: number;
  size: number;
  progress: { value: number };
}

const FireTrailDot = memo<FireTrailProps>(({ index, trailIndex, size, progress }) => {
  const [cr, cg, cb] = COLORS[index % COLORS.length]!;

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;
    const r = size * 0.02;
    const baseAngle = (index / N) * Math.PI * 2 + progress.value * Math.PI * 2;
    const trailAngle = baseAngle - trailIndex * 0.08;
    const x = cx + Math.cos(trailAngle) * orbit;
    const y = cy + Math.sin(trailAngle) * orbit;
    const alphaScale = trailIndex === 0 ? 1 : (1 - trailIndex / (TRAIL + 1)) * 0.5;
    const rScale = trailIndex === 0 ? 1 : 1 - trailIndex * 0.2;
    return { cx: x, cy: y, r: r * rScale, opacity: alphaScale * 0.75 };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={`rgb(${cr},${cg},${cb})`} />;
});
FireTrailDot.displayName = 'FireTrailDot';

export const FireRingFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(3000);
  const slowProgress = useLoopProgress(7000);

  const elements: React.JSX.Element[] = [];
  for (let i = 0; i < N; i++) {
    for (let t = TRAIL; t >= 0; t--) {
      elements.push(
        <FireTrailDot key={`${i}-${t}`} index={i} trailIndex={t} size={size} progress={progress} />,
      );
    }
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <LegendaryAura size={size} progress={slowProgress} r={240} g={80} b={0} orbit={0.42} />
        {elements}
      </Svg>
    </View>
  );
});
FireRingFlair.displayName = 'FireRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

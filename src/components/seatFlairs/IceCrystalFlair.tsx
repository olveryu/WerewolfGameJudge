/**
 * IceCrystalFlair — 冰晶棱镜
 *
 * 6 颗旋转六边形冰晶分布在外围，脉冲闪烁，细线连接中心。
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useEffect } from 'react';
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
import { AnimatedCircle, AnimatedLine, AnimatedPath } from './svgAnimatedPrimitives';

const N = 6;
const HEX_SIDES = 6;

const CrystalParticle = memo<{ index: number; size: number; progress: { value: number } }>(
  ({ index, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const dist = size * 0.32;
    const hexR = size * 0.04;

    const hexProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = (index / N) * Math.PI * 2 + t * Math.PI * 0.5;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + index * 0.5) * Math.PI));
      let d = '';
      for (let h = 0; h < HEX_SIDES; h++) {
        const ha = (h / HEX_SIDES) * Math.PI * 2 - Math.PI / 2 + t * Math.PI;
        const vx = x + Math.cos(ha) * hexR;
        const vy = y + Math.sin(ha) * hexR;
        d += h === 0 ? `M ${vx} ${vy}` : ` L ${vx} ${vy}`;
      }
      d += ' Z';
      return { d, opacity: pulse * 0.7, strokeWidth: 1.2 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const dotProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = (index / N) * Math.PI * 2 + t * Math.PI * 0.5;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + index * 0.5) * Math.PI));
      return { cx: x, cy: y, r: size * 0.01, opacity: pulse * 0.8 } as Record<string, number>;
    });

    const lineProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = (index / N) * Math.PI * 2 + t * Math.PI * 0.5;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + index * 0.5) * Math.PI));
      return { x1: cx, y1: cy, x2: x, y2: y, opacity: pulse * 0.1, strokeWidth: 0.5 } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedLine animatedProps={lineProps} stroke="rgb(150,220,255)" />
        <AnimatedPath animatedProps={hexProps} stroke="rgb(150,220,255)" fill="none" />
        <AnimatedCircle animatedProps={dotProps} fill="rgb(200,240,255)" />
      </>
    );
  },
);
CrystalParticle.displayName = 'CrystalParticle';

const INDICES = Array.from({ length: N }, (_, i) => i);

export const IceCrystalFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1);
  }, [progress]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {INDICES.map((i) => (
          <CrystalParticle key={i} index={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
IceCrystalFlair.displayName = 'IceCrystalFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

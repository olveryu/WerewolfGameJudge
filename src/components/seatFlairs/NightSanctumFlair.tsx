/** Mythic sanctum: a rotating floor sigil and rising light beneath the avatar; no state or IO. */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedG, AnimatedPath } from './svgAnimatedPrimitives';

/** Paints within the seat bounds; one animation driver is cancelled on unmount. */
export const NightSanctumFlair = memo<FlairProps>(({ size }) => {
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const sanctumProps = useAnimatedProps(() => ({
    transform: `rotate(${progress.value * 360})`,
  }));
  const risingProps = useAnimatedProps(() => {
    const phase = (progress.value * 2) % 1;
    const height = 86 - phase * 18;
    return {
      d: `M19 ${height} v-4 M37 ${height + 3} v-7 M57 ${height + 1} v-3`,
      opacity: Math.sin(phase * Math.PI) * 0.8,
    };
  });
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Ellipse
        cx={40}
        cy={90}
        rx={32}
        ry={7.5}
        fill="none"
        stroke={MYTHIC_COLORS.crimson}
        strokeWidth={1.8}
        opacity={0.3}
      />
      <G transform="translate(40 87) scale(1 .24)">
        <Circle r={32} fill="none" stroke={MYTHIC_COLORS.enamel} strokeWidth={2} opacity={0.8} />
        <AnimatedG animatedProps={sanctumProps}>
          <Circle
            r={28}
            fill="none"
            stroke={MYTHIC_COLORS.silver}
            strokeWidth={3}
            strokeDasharray="12 8 3 8"
          />
          <Path
            d="M0 -21 L18 10 H-18 Z M0 21 L-18 -10 H18 Z"
            fill="none"
            stroke={MYTHIC_COLORS.crimson}
            strokeWidth={2}
          />
          <Path
            d="M-4 -35 H4 M35 -4 V4 M-4 35 H4 M-35 -4 V4"
            fill="none"
            stroke={MYTHIC_COLORS.pearl}
            strokeWidth={3}
          />
        </AnimatedG>
      </G>
      <AnimatedPath
        animatedProps={risingProps}
        fill="none"
        stroke={MYTHIC_COLORS.crystal}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
});
NightSanctumFlair.displayName = 'NightSanctumFlair';

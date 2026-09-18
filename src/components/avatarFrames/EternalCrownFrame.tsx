/** Mythic silver blade-wing frame. Artwork stays inside the shared eight-unit overflow contract. */
import { memo, useId } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import { AnimatedG, AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import type { FrameProps } from './FrameProps';
import { NightCrownMotif } from './NightCrownMotif';

/** Coordinates wing movement, ascending energy and a crown-triggered perimeter highlight. */
export const EternalCrownFrame = memo<FrameProps>(({ size, rx }) => {
  const gradientId = useId();
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const leftWingProps = useAnimatedProps(() => ({
    transform: `translate(50 50) scale(${0.94 + Math.sin(progress.value * Math.PI) * 0.06} 1) translate(-50 -50)`,
  }));
  const crownProps = useAnimatedProps(() => ({
    transform: `translate(32 ${-5 - Math.sin(progress.value * Math.PI) * 2}) scale(.36 .26)`,
  }));
  const energyProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value * 280,
    opacity: Math.sin(Math.min(progress.value / 0.65, 1) * Math.PI) * 0.9,
  }));
  const crystalProps = useAnimatedProps(() => ({
    opacity: 0.25 + Math.pow(Math.sin(progress.value * Math.PI), 4) * 0.75,
  }));
  const releaseProps = useAnimatedProps(() => {
    const phase = Math.max(0, (progress.value - 0.5) * 2);
    return {
      strokeDashoffset: -phase * 400,
      opacity: Math.sin(phase * Math.PI),
    };
  });
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={MYTHIC_COLORS.metal} />
          <Stop offset="0.3" stopColor={MYTHIC_COLORS.pearl} />
          <Stop offset="0.6" stopColor={MYTHIC_COLORS.metal} />
          <Stop offset="1" stopColor={MYTHIC_COLORS.silver} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.4}
      />
      <Rect
        x={-2}
        y={-2}
        width={104}
        height={104}
        rx={rx + 2}
        fill="none"
        stroke={MYTHIC_COLORS.crimson}
        strokeWidth={0.6}
      />
      <AnimatedPath
        animatedProps={releaseProps}
        d={`M50 0 H${100 - rx} Q100 0 100 ${rx} V${100 - rx} Q100 100 ${100 - rx} 100 H${rx} Q0 100 0 ${100 - rx} V${rx} Q0 0 ${rx} 0 H50`}
        fill="none"
        stroke={MYTHIC_COLORS.pearl}
        strokeWidth={2}
        strokeDasharray="55 345"
        strokeLinecap="round"
      />
      <AnimatedG animatedProps={leftWingProps}>
        <G fill={MYTHIC_COLORS.obsidian} stroke={`url(#${gradientId})`} strokeWidth={0.9}>
          <Path d="M3 13 L-7 4 L-4 28 L-8 23 L-4 48 L-7 44 L-3 75 L4 92 L1 63 L3 42 L-1 22 Z" />
          <Path d="M97 13 L107 4 L104 28 L108 23 L104 48 L107 44 L103 75 L96 92 L99 63 L97 42 L101 22 Z" />
        </G>
        <G fill={`url(#${gradientId})`}>
          <Path d="M-7 4 L-1 27 L-2 48 L1 77 L-4 58 L-5 27 Z" />
          <Path d="M107 4 L101 27 L102 48 L99 77 L104 58 L105 27 Z" />
        </G>
        <Path
          d="M1 78 L-3 54 L-2 30 L-5 8 L17 1 H36 M99 78 L103 54 L102 30 L105 8 L83 1 H64"
          fill="none"
          stroke={MYTHIC_COLORS.enamel}
          strokeWidth={1.8}
        />
        <AnimatedPath
          animatedProps={energyProps}
          d="M1 78 L-3 54 L-2 30 L-5 8 L17 1 H36 M99 78 L103 54 L102 30 L105 8 L83 1 H64"
          fill="none"
          stroke={MYTHIC_COLORS.crystal}
          strokeWidth={1.8}
          strokeDasharray="14 28"
          strokeLinecap="round"
        />
      </AnimatedG>
      <AnimatedG animatedProps={crownProps}>
        <NightCrownMotif />
        <AnimatedPath
          animatedProps={crystalProps}
          d="M50 28 L58 43 L50 59 L42 43 Z"
          fill={MYTHIC_COLORS.highlight}
          stroke={MYTHIC_COLORS.pearl}
          strokeWidth={2}
        />
      </AnimatedG>
      <Path
        d="M33 100 L43 98 L50 103 L57 98 L67 100 L50 108 Z"
        fill={MYTHIC_COLORS.obsidian}
        stroke={MYTHIC_COLORS.silver}
      />
      <Path
        d="M50 96 L54 102 L50 107 L46 102 Z"
        fill={MYTHIC_COLORS.enamel}
        stroke={MYTHIC_COLORS.highlight}
        strokeWidth={0.5}
      />
      <AnimatedPath
        animatedProps={crystalProps}
        d="M50 96 L54 102 L50 104 Z"
        fill={MYTHIC_COLORS.crystal}
      />
    </Svg>
  );
});
EternalCrownFrame.displayName = 'EternalCrownFrame';

/** Mythic silver blade-wing frame. Artwork stays inside the shared eight-unit overflow contract. */
import { memo, useId } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import { AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import type { FrameProps } from './FrameProps';
import { NightCrownMotif } from './NightCrownMotif';

/** Renders the complete crown frame, including its independent breathing crystal. */
export const EternalCrownFrame = memo<FrameProps>(({ size, rx }) => {
  const gradientId = useId();
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const crystalProps = useAnimatedProps(() => ({
    opacity: 0.55 + Math.sin(progress.value * Math.PI * 2) * 0.3,
  }));
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
      <G fill={MYTHIC_COLORS.obsidian} stroke={`url(#${gradientId})`} strokeWidth={0.9}>
        <Path d="M3 13 L-7 4 L-4 28 L-8 23 L-4 48 L-7 44 L-3 75 L4 92 L1 63 L3 42 L-1 22 Z" />
        <Path d="M97 13 L107 4 L104 28 L108 23 L104 48 L107 44 L103 75 L96 92 L99 63 L97 42 L101 22 Z" />
      </G>
      <G fill={`url(#${gradientId})`}>
        <Path d="M-7 4 L-1 27 L-2 48 L1 77 L-4 58 L-5 27 Z" />
        <Path d="M107 4 L101 27 L102 48 L99 77 L104 58 L105 27 Z" />
      </G>
      <G transform="translate(32 -8) scale(.36 .26)">
        <NightCrownMotif />
      </G>
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

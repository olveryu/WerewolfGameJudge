/** Mythic sanctum: perimeter runes and moving crimson engravings, leaving the avatar center clear. */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedPath } from './svgAnimatedPrimitives';

const INSCRIPTIONS = [0, 90, 180, 270] as const;

/** Paints within the seat bounds; one animation driver is cancelled on unmount. */
export const NightSanctumFlair = memo<FlairProps>(({ size, borderRadius }) => {
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const flowingProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value * 384,
    opacity: 0.45 + Math.sin(progress.value * Math.PI * 2) * 0.15,
  }));
  const radius = (borderRadius * 100) / size;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Rect
        x={2}
        y={2}
        width={96}
        height={96}
        rx={radius}
        fill="none"
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={0.5}
        opacity={0.45}
      />
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={radius}
        fill="none"
        stroke={MYTHIC_COLORS.metal}
        strokeWidth={0.4}
        opacity={0.55}
      />
      {INSCRIPTIONS.map((angle) => (
        <G key={angle} transform={`rotate(${angle} 50 50)`}>
          <Path
            d="M38 5 L44 8 L50 3 L56 8 L62 5 M46 3 L50 9 L54 3 M22 3 L24 6 L26 3 M74 3 L76 6 L78 3"
            stroke={MYTHIC_COLORS.silver}
            strokeWidth={0.65}
            fill="none"
          />
          <Path
            d="M50 1 L52 4 L50 7 L48 4 Z"
            fill={MYTHIC_COLORS.enamel}
            stroke={MYTHIC_COLORS.highlight}
            strokeWidth={0.35}
          />
        </G>
      ))}
      <AnimatedPath
        animatedProps={flowingProps}
        d="M12 3 H88 Q97 3 97 12 V88 Q97 97 88 97 H12 Q3 97 3 88 V12 Q3 3 12 3"
        fill="none"
        stroke={MYTHIC_COLORS.crimson}
        strokeWidth={1.2}
        strokeDasharray="18 78"
      />
    </Svg>
  );
});
NightSanctumFlair.displayName = 'NightSanctumFlair';

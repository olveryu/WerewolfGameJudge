/**
 * SimpleOctagonFrame — Octagon
 *
 * Octagonal border clip. Common-tier avatar frame template.
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** Generate the octagon path (viewBox 100×100; corner cut size is rx-related). */
function octagonPath(cut: number): string {
  return [
    `M ${cut} 0`,
    `L ${100 - cut} 0`,
    `L 100 ${cut}`,
    `L 100 ${100 - cut}`,
    `L ${100 - cut} 100`,
    `L ${cut} 100`,
    `L 0 ${100 - cut}`,
    `L 0 ${cut}`,
    'Z',
  ].join(' ');
}

export const SimpleOctagonFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const userId = useId();
  const gradId = `octGrad${userId}`;
  const cut = Math.min(rx * 0.7, 25);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.4} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.75} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      {/* Octagon border */}
      <Path
        d={octagonPath(cut)}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
SimpleOctagonFrame.displayName = 'SimpleOctagonFrame';

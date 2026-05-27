/**
 * SimpleRoundFrame — Round Ring
 *
 * Solid-color circular border + subtle outer glow. Common-tier avatar frame template.
 * Accepts FrameProps + color; color variants are injected by the factory.
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleRoundFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const userId = useId();
  const gradId = `roundGrad${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.45} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.75} />
        </LinearGradient>
      </Defs>
      {/* Main border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
      />
    </Svg>
  );
});
SimpleRoundFrame.displayName = 'SimpleRoundFrame';

/**
 * SimpleSquareFrame — 方框
 *
 * 直角方框 + 内外双线。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleSquareFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `squareGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.85} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.9} />
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
SimpleSquareFrame.displayName = 'SimpleSquareFrame';

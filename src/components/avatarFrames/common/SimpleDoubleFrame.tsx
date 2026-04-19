/**
 * SimpleDoubleFrame — 双线
 *
 * 双层同色边框。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleDoubleFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `dblGrad${uid}`;
  const innerRx = Math.max(rx - 6, 2);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.8} />
        </LinearGradient>
      </Defs>
      {/* Outer border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.5}
      />
      {/* Inner border */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={innerRx}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1}
        opacity={0.45}
      />
    </Svg>
  );
});
SimpleDoubleFrame.displayName = 'SimpleDoubleFrame';

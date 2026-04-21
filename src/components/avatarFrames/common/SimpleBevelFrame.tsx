/**
 * SimpleBevelFrame — 斜面
 *
 * 带有倒角和内嵌线条的边框。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleBevelFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const userId = useId();
  const outerGradId = `bevelOuter${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={outerGradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.6} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.75} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      {/* Main bevel border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${outerGradId})`}
        strokeWidth={2}
      />
    </Svg>
  );
});
SimpleBevelFrame.displayName = 'SimpleBevelFrame';

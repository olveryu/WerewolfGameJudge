/**
 * SimpleDiamondFrame — 菱形
 *
 * 圆角矩形渐变边框。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleDiamondFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const userId = useId();
  const gradId = `diamGrad${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.4} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.75} />
        </LinearGradient>
      </Defs>
      {/* Main rounded-rect border */}
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
SimpleDiamondFrame.displayName = 'SimpleDiamondFrame';

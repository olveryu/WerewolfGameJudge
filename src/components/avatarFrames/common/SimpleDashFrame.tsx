/**
 * SimpleDashFrame — 虚线
 *
 * 虚线圆角边框。Common 级头像框模板。
 */
import { memo } from 'react';
import Svg, { Rect } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleDashFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      {/* Dash border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.5}
        strokeDasharray="8 4"
        opacity={0.7}
      />
    </Svg>
  );
});
SimpleDashFrame.displayName = 'SimpleDashFrame';

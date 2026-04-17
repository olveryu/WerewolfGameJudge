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
        strokeWidth={2}
        strokeDasharray="8 4"
        opacity={0.85}
      />
      {/* Subtle inner glow */}
      <Rect
        x={3}
        y={3}
        width={94}
        height={94}
        rx={Math.max(rx - 3, 0)}
        fill="none"
        stroke={colors.light}
        strokeWidth={0.8}
        opacity={0.3}
      />
    </Svg>
  );
});
SimpleDashFrame.displayName = 'SimpleDashFrame';

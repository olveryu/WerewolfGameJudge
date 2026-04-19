/**
 * SimpleDiamondFrame — 菱形
 *
 * 圆角矩形主边框 + 四边中点各嵌一个小菱形装饰。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** Small diamond at (cx, cy) with given half-size */
function diamondAt(cx: number, cy: number, s: number): string {
  return `M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`;
}

export const SimpleDiamondFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `diamGrad${uid}`;
  const d = 5; // diamond half-size
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.9} />
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
        strokeWidth={2.5}
      />
      {/* Diamond accents at edge midpoints */}
      <Path d={diamondAt(50, -1, d)} fill={colors.primary} opacity={0.85} />
      <Path d={diamondAt(101, 50, d)} fill={colors.primary} opacity={0.85} />
      <Path d={diamondAt(50, 101, d)} fill={colors.primary} opacity={0.85} />
      <Path d={diamondAt(-1, 50, d)} fill={colors.primary} opacity={0.85} />
    </Svg>
  );
});
SimpleDiamondFrame.displayName = 'SimpleDiamondFrame';

/**
 * GemFrame — 宝石
 *
 * Border with small diamond-shaped decorations at the 4 midpoints of each edge.
 * Rare 级头像框模板.
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** Small diamond at (cx, cy) with half-size s */
function diamondAt(cx: number, cy: number, s: number): string {
  return `M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`;
}

export const GemFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gBorder = `gemB${uid}`;
  const gemSize = 5;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gBorder} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.9} />
          <Stop offset="0.4" stopColor={colors.light} stopOpacity={0.8} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Outer glow */}
      <Rect
        x={-2}
        y={-2}
        width={104}
        height={104}
        rx={rx + 2}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1}
        opacity={0.2}
      />
      {/* Main border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gBorder})`}
        strokeWidth={3}
      />
      {/* 4 gem decorations at edge midpoints */}
      <Path d={diamondAt(50, 0, gemSize)} fill={colors.light} opacity={0.85} />
      <Path d={diamondAt(100, 50, gemSize)} fill={colors.light} opacity={0.85} />
      <Path d={diamondAt(50, 100, gemSize)} fill={colors.light} opacity={0.85} />
      <Path d={diamondAt(0, 50, gemSize)} fill={colors.light} opacity={0.85} />
      {/* Inner accent */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 5, 2)}
        fill="none"
        stroke={colors.primary}
        strokeWidth={0.8}
        opacity={0.45}
      />
    </Svg>
  );
});
GemFrame.displayName = 'GemFrame';

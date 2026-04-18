/**
 * FiligreeFrame — 花纹
 *
 * Corner scrollwork arcs on each corner + main border.
 * Rare 级头像框模板.
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const FiligreeFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gBorder = `filBord${uid}`;
  // Small scroll arcs at each corner
  const a = 18; // arc size
  const scrollPaths = [
    // Top-left corner scrollwork
    `M ${a} 0 Q 0 0 0 ${a}`,
    `M ${a + 4} 4 Q 4 4 4 ${a + 4}`,
    // Top-right
    `M ${100 - a} 0 Q 100 0 100 ${a}`,
    `M ${100 - a - 4} 4 Q 96 4 96 ${a + 4}`,
    // Bottom-right
    `M 100 ${100 - a} Q 100 100 ${100 - a} 100`,
    `M 96 ${100 - a - 4} Q 96 96 ${100 - a - 4} 96`,
    // Bottom-left
    `M 0 ${100 - a} Q 0 100 ${a} 100`,
    `M 4 ${100 - a - 4} Q 4 96 ${a + 4} 96`,
  ];
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gBorder} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.6} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.8} />
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
        stroke={`url(#${gBorder})`}
        strokeWidth={2}
      />
      {/* Corner scrollwork */}
      {scrollPaths.map((d, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke={colors.light}
          strokeWidth={1.2}
          opacity={0.65}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
});
FiligreeFrame.displayName = 'FiligreeFrame';

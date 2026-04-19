/**
 * SimpleCrossFrame — 十字
 *
 * 十字形裁切边框（4 个凹角）。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/**
 * Build a cross-cut path: rectangle with concave corners.
 * `inset` controls how deep the corner cuts are.
 */
function crossPath(inset: number): string {
  const i = inset;
  return [
    `M ${i} 0`,
    `L ${100 - i} 0`,
    `L ${100 - i} ${i}`,
    `L 100 ${i}`,
    `L 100 ${100 - i}`,
    `L ${100 - i} ${100 - i}`,
    `L ${100 - i} 100`,
    `L ${i} 100`,
    `L ${i} ${100 - i}`,
    `L 0 ${100 - i}`,
    `L 0 ${i}`,
    `L ${i} ${i}`,
    'Z',
  ].join(' ');
}

export const SimpleCrossFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `crossGrad${uid}`;
  const inset = Math.min(rx * 0.5, 18);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.dark} stopOpacity={0.65} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.75} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.65} />
        </LinearGradient>
      </Defs>
      <Path
        d={crossPath(inset)}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
SimpleCrossFrame.displayName = 'SimpleCrossFrame';

/**
 * SimpleOctagonFrame — 八角
 *
 * 八边形边框裁切。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** 生成八边形路径（viewBox 100×100，切角 = rx 相关） */
function octagonPath(cut: number): string {
  return [
    `M ${cut} 0`,
    `L ${100 - cut} 0`,
    `L 100 ${cut}`,
    `L 100 ${100 - cut}`,
    `L ${100 - cut} 100`,
    `L ${cut} 100`,
    `L 0 ${100 - cut}`,
    `L 0 ${cut}`,
    'Z',
  ].join(' ');
}

export const SimpleOctagonFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `octGrad${uid}`;
  const cut = Math.min(rx * 0.7, 25);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.5} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      {/* Octagon border */}
      <Path
        d={octagonPath(cut)}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
SimpleOctagonFrame.displayName = 'SimpleOctagonFrame';

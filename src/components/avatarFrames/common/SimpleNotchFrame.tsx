/**
 * SimpleNotchFrame — 缺角
 *
 * 四角各有三角形缺口。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** Rectangle with triangle notches at all 4 corners. */
function notchPath(n: number): string {
  return [
    `M ${n} 0`,
    `L ${100 - n} 0`,
    `L 100 ${n}`,
    `L 100 ${100 - n}`,
    `L ${100 - n} 100`,
    `L ${n} 100`,
    `L 0 ${100 - n}`,
    `L 0 ${n}`,
    'Z',
  ].join(' ');
}

export const SimpleNotchFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gradId = `notchGrad${uid}`;
  const notch = Math.min(rx * 0.6, 15);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.45} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      <Path
        d={notchPath(notch)}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
SimpleNotchFrame.displayName = 'SimpleNotchFrame';

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
  const uid = useId();
  const outerGradId = `bevelOuter${uid}`;
  const innerGradId = `bevelInner${uid}`;
  const innerRx = Math.max(rx - 4, 2);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={outerGradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.75} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={innerGradId} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.4} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      {/* Outer bevel */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${outerGradId})`}
        strokeWidth={3}
      />
      {/* Inner bevel inset */}
      <Rect
        x={4}
        y={4}
        width={92}
        height={92}
        rx={innerRx}
        fill="none"
        stroke={`url(#${innerGradId})`}
        strokeWidth={1}
      />
    </Svg>
  );
});
SimpleBevelFrame.displayName = 'SimpleBevelFrame';

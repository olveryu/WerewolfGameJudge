/**
 * GrooveFrame — 槽纹
 *
 * Triple-line border with highlight/shadow to simulate an engraved groove.
 * Rare 级头像框模板.
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const GrooveFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gOuter = `grooveO${uid}`;
  const gInner = `grooveI${uid}`;
  const midRx = Math.max(rx - 3, 2);
  const innerRx = Math.max(rx - 6, 2);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        {/* Outer: highlight gradient (light → mid) simulates raised edge */}
        <LinearGradient id={gOuter} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.95} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.7} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.8} />
        </LinearGradient>
        {/* Inner: shadow gradient (dark → mid) simulates recessed edge */}
        <LinearGradient id={gInner} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.dark} stopOpacity={0.85} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.65} />
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
      {/* Highlight edge (raised) */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gOuter})`}
        strokeWidth={3}
      />
      {/* Groove channel */}
      <Rect
        x={3}
        y={3}
        width={94}
        height={94}
        rx={midRx}
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        opacity={0.55}
      />
      {/* Shadow edge (recessed) */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={innerRx}
        fill="none"
        stroke={`url(#${gInner})`}
        strokeWidth={2}
      />
    </Svg>
  );
});
GrooveFrame.displayName = 'GrooveFrame';

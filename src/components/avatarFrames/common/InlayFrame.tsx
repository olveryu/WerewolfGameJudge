/**
 * InlayFrame — 嵌边
 *
 * Thick outer border with a colored inlay stripe running inside.
 * Rare 级头像框模板 — visually richer than common (3-layer border stack).
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const InlayFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gOuter = `inlayO${uid}`;
  const gInlay = `inlayI${uid}`;
  const midRx = Math.max(rx - 3, 2);
  const innerRx = Math.max(rx - 6, 2);
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gOuter} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.dark} stopOpacity={0.95} />
          <Stop offset="0.5" stopColor={colors.light} stopOpacity={0.6} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={gInlay} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.light} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.8} />
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
      {/* Outer thick border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gOuter})`}
        strokeWidth={4}
      />
      {/* Colored inlay stripe */}
      <Rect
        x={4}
        y={4}
        width={92}
        height={92}
        rx={midRx}
        fill="none"
        stroke={`url(#${gInlay})`}
        strokeWidth={2.5}
      />
      {/* Inner trim */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={innerRx}
        fill="none"
        stroke={colors.dark}
        strokeWidth={1}
        opacity={0.5}
      />
    </Svg>
  );
});
InlayFrame.displayName = 'InlayFrame';

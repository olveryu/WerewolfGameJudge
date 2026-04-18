/**
 * ChainFrame — 锁链
 *
 * Linked oval "chain" pattern along the border.
 * Rare 级头像框模板.
 */
import { memo, useId } from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** Build chain link positions along one edge */
function edgeLinks(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count: number,
): { cx: number; cy: number; angle: number }[] {
  const links: { cx: number; cy: number; angle: number }[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    links.push({ cx: x1 + dx * t, cy: y1 + dy * t, angle });
  }
  return links;
}

export const ChainFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const uid = useId();
  const gBorder = `chainB${uid}`;
  const links = [
    ...edgeLinks(0, 0, 100, 0, 6), // top
    ...edgeLinks(100, 0, 100, 100, 6), // right
    ...edgeLinks(100, 100, 0, 100, 6), // bottom
    ...edgeLinks(0, 100, 0, 0, 6), // left
  ];
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gBorder} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.7} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.75} />
        </LinearGradient>
      </Defs>
      {/* Base border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gBorder})`}
        strokeWidth={1.5}
      />
      {/* Chain links */}
      {links.map((link, i) => (
        <Ellipse
          key={i}
          cx={link.cx}
          cy={link.cy}
          rx={4.5}
          ry={2.5}
          rotation={link.angle}
          fill="none"
          stroke={colors.light}
          strokeWidth={1}
          opacity={0.6}
        />
      ))}
    </Svg>
  );
});
ChainFrame.displayName = 'ChainFrame';

/**
 * SimpleScallopFrame — 波浪
 *
 * 半圆弧组成的波浪形边框。Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/**
 * Build a scallop (wave) border path.
 * Each edge has 5 arcs.
 */
function scallopPath(): string {
  const step = 20; // 100 / 5 arcs per edge
  const r = step / 2;
  const parts: string[] = [`M 0 0`];
  // Top edge: left → right
  for (let i = 0; i < 5; i++) {
    const x = i * step + step;
    parts.push(`A ${r} ${r} 0 0 1 ${x} 0`);
  }
  // Right edge: top → bottom
  for (let i = 0; i < 5; i++) {
    const y = i * step + step;
    parts.push(`A ${r} ${r} 0 0 1 100 ${y}`);
  }
  // Bottom edge: right → left
  for (let i = 4; i >= 0; i--) {
    const x = i * step;
    parts.push(`A ${r} ${r} 0 0 1 ${x} 100`);
  }
  // Left edge: bottom → top
  for (let i = 4; i >= 0; i--) {
    const y = i * step;
    parts.push(`A ${r} ${r} 0 0 1 0 ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

export const SimpleScallopFrame = memo<ColoredFrameProps>(({ size, colors }) => {
  const uid = useId();
  const gradId = `scallGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.8} />
          <Stop offset="1" stopColor={colors.dark} stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Path d={scallopPath()} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} />
    </Svg>
  );
});
SimpleScallopFrame.displayName = 'SimpleScallopFrame';

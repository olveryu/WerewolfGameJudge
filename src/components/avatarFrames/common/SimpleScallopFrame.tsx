/**
 * SimpleScallopFrame — 波浪
 *
 * 10 shallow cubic-bezier waves per edge — elegant stamp/porcelain rim.
 * Common 级头像框模板。
 */
import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { FrameProps } from '../FrameProps';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

const N = 10; // waves per edge
const STEP = 100 / N;
const AMP = 2.8; // wave depth — shallow for elegance
const CP = STEP * 0.45; // bezier control-point offset

/**
 * Build a scallop border path with shallow bezier waves.
 */
function scallopPath(): string {
  const parts: string[] = [`M 0 ${AMP}`];

  // Top edge: left → right (waves bulge outward = negative y)
  for (let i = 0; i < N; i++) {
    const x0 = i * STEP;
    const x1 = x0 + STEP;
    const xm = x0 + STEP / 2;
    parts.push(`C ${x0 + CP} ${-AMP}, ${xm - CP} ${-AMP}, ${xm} 0`);
    parts.push(`C ${xm + CP} ${AMP}, ${x1 - CP} ${AMP}, ${x1} ${AMP}`);
  }

  // Right edge: top → bottom (waves bulge outward = positive x)
  for (let i = 0; i < N; i++) {
    const y0 = i * STEP;
    const y1 = y0 + STEP;
    const ym = y0 + STEP / 2;
    parts.push(`C ${100 + AMP} ${y0 + CP}, ${100 + AMP} ${ym - CP}, ${100} ${ym}`);
    parts.push(`C ${100 - AMP} ${ym + CP}, ${100 - AMP} ${y1 - CP}, ${100 - AMP} ${y1}`);
  }

  // Bottom edge: right → left (waves bulge outward = positive y)
  for (let i = N - 1; i >= 0; i--) {
    const x1 = (i + 1) * STEP;
    const x0 = i * STEP;
    const xm = x0 + STEP / 2;
    parts.push(`C ${x1 - CP} ${100 + AMP}, ${xm + CP} ${100 + AMP}, ${xm} ${100}`);
    parts.push(`C ${xm - CP} ${100 - AMP}, ${x0 + CP} ${100 - AMP}, ${x0} ${100 - AMP}`);
  }

  // Left edge: bottom → top (waves bulge outward = negative x)
  for (let i = N - 1; i >= 0; i--) {
    const y1 = (i + 1) * STEP;
    const y0 = i * STEP;
    const ym = y0 + STEP / 2;
    parts.push(`C ${-AMP} ${y1 - CP}, ${-AMP} ${ym + CP}, ${0} ${ym}`);
    parts.push(`C ${AMP} ${ym - CP}, ${AMP} ${y0 + CP}, ${AMP} ${y0}`);
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

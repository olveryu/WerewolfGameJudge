/**
 * SimpleNotchFrame — 缺角
 *
 * 四角各有三角形缺口。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
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
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const notch = Math.min(rxVal * 0.6, 15);
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs><linearGradient id="a" x1="0.5" y1="0" x2="0.5" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.45"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.7"/>` +
        `</linearGradient></defs>` +
        `<path d="${notchPath(notch)}" fill="none" stroke="url(#a)" stroke-width="2" stroke-linejoin="round"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleNotchFrame.displayName = 'SimpleNotchFrame';

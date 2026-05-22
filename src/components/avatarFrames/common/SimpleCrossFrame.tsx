/**
 * SimpleCrossFrame — 十字
 *
 * 十字形裁切边框（4 个凹角）。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
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
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const inset = Math.min(rxVal * 0.5, 18);
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${colors.dark}" stop-opacity="0.65"/>` +
        `<stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>` +
        `<stop offset="1" stop-color="${colors.dark}" stop-opacity="0.65"/>` +
        `</linearGradient></defs>` +
        `<path d="${crossPath(inset)}" fill="none" stroke="url(#a)" stroke-width="2" stroke-linejoin="round"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleCrossFrame.displayName = 'SimpleCrossFrame';

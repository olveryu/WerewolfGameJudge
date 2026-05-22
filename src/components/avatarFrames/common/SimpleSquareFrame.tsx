/**
 * SimpleSquareFrame — 方框
 *
 * 直角方框 + 内外双线。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleSquareFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${colors.primary}" stop-opacity="0.85"/>` +
        `<stop offset="1" stop-color="${colors.dark}" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="2"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleSquareFrame.displayName = 'SimpleSquareFrame';

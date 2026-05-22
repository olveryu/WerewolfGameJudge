/**
 * SimpleBevelFrame — 斜面
 *
 * 带有倒角和内嵌线条的边框。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleBevelFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.6"/>` +
        `<stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>` +
        `<stop offset="1" stop-color="${colors.dark}" stop-opacity="0.7"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="2"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleBevelFrame.displayName = 'SimpleBevelFrame';

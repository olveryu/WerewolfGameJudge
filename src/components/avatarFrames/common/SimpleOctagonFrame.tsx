/**
 * SimpleOctagonFrame — 八角
 *
 * 八边形边框裁切。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

/** 生成八边形路径（viewBox 100×100，切角 = rx 相关） */
function octagonPath(cut: number): string {
  return [
    `M ${cut} 0`,
    `L ${100 - cut} 0`,
    `L 100 ${cut}`,
    `L 100 ${100 - cut}`,
    `L ${100 - cut} 100`,
    `L ${cut} 100`,
    `L 0 ${100 - cut}`,
    `L 0 ${cut}`,
    'Z',
  ].join(' ');
}

export const SimpleOctagonFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const cut = Math.min(rxVal * 0.7, 25);
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.4"/>` +
        `<stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>` +
        `<stop offset="1" stop-color="${colors.dark}" stop-opacity="0.7"/>` +
        `</linearGradient></defs>` +
        `<path d="${octagonPath(cut)}" fill="none" stroke="url(#a)" stroke-width="2" stroke-linejoin="round"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleOctagonFrame.displayName = 'SimpleOctagonFrame';

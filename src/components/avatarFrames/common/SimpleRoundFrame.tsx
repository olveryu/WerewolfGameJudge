/**
 * SimpleRoundFrame — 圆环
 *
 * 单色圆形边框 + 微弱外发光。Common 级头像框模板。
 * 接受 FrameProps + color 参数，由工厂传入颜色生成变体。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleRoundFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.45"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.75"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="2"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleRoundFrame.displayName = 'SimpleRoundFrame';

/**
 * GrooveFrame — 槽纹
 *
 * Triple-line border with highlight/shadow to simulate an engraved groove.
 * Rare 级头像框模板.
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const GrooveFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const midRx = Math.max(rxVal - 3, 2);
      const innerRx = Math.max(rxVal - 6, 2);
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.7"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.8"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${colors.dark}" stop-opacity="0.85"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.65"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="-2" y="-2" width="104" height="104" rx="${rxVal + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="3" y="3" width="94" height="94" rx="${midRx}" fill="none" stroke="${colors.primary}" stroke-width="3" opacity="0.55"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${innerRx}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
GrooveFrame.displayName = 'GrooveFrame';

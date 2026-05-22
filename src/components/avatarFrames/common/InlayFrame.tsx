/**
 * InlayFrame — 嵌边
 *
 * Thick outer border with a colored inlay stripe running inside.
 * Rare 级头像框模板 — visually richer than common (3-layer border stack).
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const InlayFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const midRx = Math.max(rxVal - 3, 2);
      const innerRx = Math.max(rxVal - 6, 2);
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${colors.dark}" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="${colors.light}" stop-opacity="0.6"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${colors.light}" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="${colors.primary}" stop-opacity="0.8"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="-2" y="-2" width="104" height="104" rx="${rxVal + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4"/>` +
        `<rect x="4" y="4" width="92" height="92" rx="${midRx}" fill="none" stroke="url(#b)" stroke-width="2.5"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${innerRx}" fill="none" stroke="${colors.dark}" stroke-width="1" opacity="0.5"/>` +
        `</svg>`
      );
    },
    [colors.primary, colors.light, colors.dark],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
InlayFrame.displayName = 'InlayFrame';

/**
 * SimpleDashFrame — 虚线
 *
 * 虚线圆角边框。Common 级头像框模板。
 * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from '../FrameProps';
import { SvgFrame } from '../SvgFrame';
import type { FrameColorSet } from './palette';

interface ColoredFrameProps extends FrameProps {
  colors: FrameColorSet;
}

export const SimpleDashFrame = memo<ColoredFrameProps>(({ size, rx, colors }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
      `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="${colors.primary}" stroke-width="1.5" stroke-dasharray="8 4" opacity="0.7"/>` +
      `</svg>`,
    [colors.primary],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SimpleDashFrame.displayName = 'SimpleDashFrame';

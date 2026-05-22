/** DuskIronFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const DuskIronFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#6A6A70" stop-opacity="0.9"/>` +
        `<stop offset="0.4" stop-color="#3A3A40" stop-opacity="1"/>` +
        `<stop offset="0.6" stop-color="#2A2A30" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#6A6A70" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A0A10" stroke-width="6.5" opacity="0.18"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#5A5A60" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M-4,-4 L8,-4 L-4,8 Z" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.8" opacity="0.8"/>` +
        `<path d="M104,-4 L92,-4 L104,8 Z" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.8" opacity="0.8"/>` +
        `<path d="M-4,104 L8,104 L-4,92 Z" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.8" opacity="0.8"/>` +
        `<path d="M104,104 L92,104 L104,92 Z" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="25" cy="-1" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="50" cy="-1" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="75" cy="-1" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="25" cy="101" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="50" cy="101" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="75" cy="101" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="-1" cy="25" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="-1" cy="50" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="-1" cy="75" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="101" cy="25" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="101" cy="50" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="101" cy="75" r="2.5" fill="#4A4A50" stroke="#7A7A80" stroke-width="0.6" opacity="0.75"/>` +
        `<circle cx="25" cy="-1.5" r="0.8" fill="#9A9AA0" opacity="0.6"/>` +
        `<circle cx="50" cy="-1.5" r="0.8" fill="#9A9AA0" opacity="0.6"/>` +
        `<circle cx="75" cy="-1.5" r="0.8" fill="#9A9AA0" opacity="0.6"/>` +
        `<path d="M10,0 L12,3" stroke="#8B5A2B" stroke-width="1" opacity="0.35" stroke-linecap="round"/>` +
        `<path d="M88,100 L90,97" stroke="#8B5A2B" stroke-width="1" opacity="0.35" stroke-linecap="round"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
DuskIronFrame.displayName = 'DuskIronFrame';

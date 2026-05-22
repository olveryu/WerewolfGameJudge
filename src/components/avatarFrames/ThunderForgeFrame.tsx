/** ThunderForgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const ThunderForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#2980B9" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#1A5276" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2980B9" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A1A30" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#5DADE2" stroke-width="0.6" opacity="0.35"/>` +
        `<path d="M15,-5 L20,-1 L12,3 L22,0" fill="none" stroke="#F4D03F" stroke-width="1.8" opacity="0.85" stroke-linecap="round" stroke-linejoin="bevel"/>` +
        `<path d="M85,-5 L80,-1 L88,3 L78,0" fill="none" stroke="#F4D03F" stroke-width="1.8" opacity="0.85" stroke-linecap="round" stroke-linejoin="bevel"/>` +
        `<path d="M15,105 L20,101 L12,97 L22,100" fill="none" stroke="#F4D03F" stroke-width="1.8" opacity="0.85" stroke-linecap="round" stroke-linejoin="bevel"/>` +
        `<path d="M85,105 L80,101 L88,97 L78,100" fill="none" stroke="#F4D03F" stroke-width="1.8" opacity="0.85" stroke-linecap="round" stroke-linejoin="bevel"/>` +
        `<path d="M-4,35 L2,38 L-2,42 L4,40" fill="none" stroke="#F4D03F" stroke-width="1.3" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M-4,65 L2,62 L-2,58 L4,60" fill="none" stroke="#F4D03F" stroke-width="1.3" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M104,30 L98,33 L102,37 L96,35" fill="none" stroke="#F4D03F" stroke-width="1.3" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M104,70 L98,67 L102,63 L96,65" fill="none" stroke="#F4D03F" stroke-width="1.3" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M15,-5 L20,-1 L12,3" fill="none" stroke="#FDEBD0" stroke-width="0.5" opacity="0.4"/>` +
        `<path d="M85,-5 L80,-1 L88,3" fill="none" stroke="#FDEBD0" stroke-width="0.5" opacity="0.4"/>` +
        `<circle cx="50" cy="-3" r="2.5" fill="#1A5276" stroke="#5DADE2" stroke-width="1" opacity="0.7"/>` +
        `<circle cx="50" cy="-3" r="1" fill="#AED6F1" opacity="0.8"/>` +
        `<circle cx="50" cy="103" r="2.5" fill="#1A5276" stroke="#5DADE2" stroke-width="1" opacity="0.7"/>` +
        `<circle cx="50" cy="103" r="1" fill="#AED6F1" opacity="0.8"/>` +
        `<circle cx="-3" cy="50" r="2" fill="#1A5276" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<circle cx="103" cy="50" r="2" fill="#1A5276" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
ThunderForgeFrame.displayName = 'ThunderForgeFrame';

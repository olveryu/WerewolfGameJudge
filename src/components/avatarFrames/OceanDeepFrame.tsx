/** OceanDeepFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const OceanDeepFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#1A5276" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#0E3651" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#1A5276" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#2E86C1" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M-2,-2 Q-8,5 -6,12 Q-4,8 -1,5" fill="none" stroke="#1A5276" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M-2,0 Q-10,8 -7,15" fill="none" stroke="#2E86C1" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,-2 Q108,5 106,12 Q104,8 101,5" fill="none" stroke="#1A5276" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M102,0 Q110,8 107,15" fill="none" stroke="#2E86C1" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-2,102 Q-8,95 -6,88 Q-4,92 -1,95" fill="none" stroke="#1A5276" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M-2,100 Q-10,92 -7,85" fill="none" stroke="#2E86C1" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,102 Q108,95 106,88 Q104,92 101,95" fill="none" stroke="#1A5276" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M25,-1 Q30,-6 35,-1" fill="none" stroke="#2E86C1" stroke-width="1.5" opacity="0.65" stroke-linecap="round"/>` +
        `<path d="M55,-1 Q60,-5 65,-1" fill="none" stroke="#2E86C1" stroke-width="1.5" opacity="0.65" stroke-linecap="round"/>` +
        `<path d="M30,101 Q35,106 40,101" fill="none" stroke="#2E86C1" stroke-width="1.5" opacity="0.65" stroke-linecap="round"/>` +
        `<path d="M60,101 Q65,105 70,101" fill="none" stroke="#2E86C1" stroke-width="1.5" opacity="0.65" stroke-linecap="round"/>` +
        `<circle cx="-4" cy="30" r="2" fill="none" stroke="#5DADE2" stroke-width="0.7" opacity="0.6"/>` +
        `<circle cx="-5" cy="25" r="1.5" fill="none" stroke="#5DADE2" stroke-width="0.6" opacity="0.5"/>` +
        `<circle cx="-6" cy="21" r="1" fill="none" stroke="#5DADE2" stroke-width="0.5" opacity="0.4"/>` +
        `<circle cx="104" cy="70" r="2" fill="none" stroke="#5DADE2" stroke-width="0.7" opacity="0.6"/>` +
        `<circle cx="105" cy="75" r="1.5" fill="none" stroke="#5DADE2" stroke-width="0.6" opacity="0.5"/>` +
        `<circle cx="106" cy="79" r="1" fill="none" stroke="#5DADE2" stroke-width="0.5" opacity="0.4"/>` +
        `<circle cx="15" cy="-3" r="1.2" fill="#5DADE2" opacity="0.7"/>` +
        `<circle cx="85" cy="103" r="1.2" fill="#5DADE2" opacity="0.7"/>` +
        `<circle cx="50" cy="-3" r="1.5" fill="#AED6F1" opacity="0.6"/>` +
        `<circle cx="50" cy="103" r="1.5" fill="#AED6F1" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
OceanDeepFrame.displayName = 'OceanDeepFrame';

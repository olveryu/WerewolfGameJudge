/** ShadowWeaveFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const ShadowWeaveFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#303030" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#1A1A1A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#303030" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="2" y="2" width="100" height="100" rx="${rxVal}" fill="none" stroke="#000" stroke-width="5" opacity="0.3"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#3A3A3A" stroke-width="0.6" opacity="0.5"/>` +
        `<path d="M15,1 Q20,-3 25,1 Q30,-3 35,1 Q40,-3 45,1 Q50,-3 55,1 Q60,-3 65,1 Q70,-3 75,1 Q80,-3 85,1" fill="none" stroke="#666" stroke-width="1.2" opacity="0.55"/>` +
        `<path d="M15,1 Q20,5 25,1 Q30,5 35,1 Q40,5 45,1 Q50,5 55,1 Q60,5 65,1 Q70,5 75,1 Q80,5 85,1" fill="none" stroke="#444" stroke-width="0.8" opacity="0.4"/>` +
        `<path d="M15,99 Q20,103 25,99 Q30,103 35,99 Q40,103 45,99 Q50,103 55,99 Q60,103 65,99 Q70,103 75,99 Q80,103 85,99" fill="none" stroke="#666" stroke-width="1.2" opacity="0.55"/>` +
        `<path d="M15,99 Q20,95 25,99 Q30,95 35,99 Q40,95 45,99 Q50,95 55,99 Q60,95 65,99 Q70,95 75,99 Q80,95 85,99" fill="none" stroke="#444" stroke-width="0.8" opacity="0.4"/>` +
        `<path d="M1,15 Q-3,20 1,25 Q-3,30 1,35 Q-3,40 1,45 Q-3,50 1,55 Q-3,60 1,65 Q-3,70 1,75 Q-3,80 1,85" fill="none" stroke="#666" stroke-width="1.2" opacity="0.55"/>` +
        `<path d="M1,15 Q5,20 1,25 Q5,30 1,35 Q5,40 1,45 Q5,50 1,55 Q5,60 1,65 Q5,70 1,75 Q5,80 1,85" fill="none" stroke="#444" stroke-width="0.8" opacity="0.4"/>` +
        `<path d="M99,15 Q103,20 99,25 Q103,30 99,35 Q103,40 99,45 Q103,50 99,55 Q103,60 99,65 Q103,70 99,75 Q103,80 99,85" fill="none" stroke="#666" stroke-width="1.2" opacity="0.55"/>` +
        `<path d="M99,15 Q95,20 99,25 Q95,30 99,35 Q95,40 99,45 Q95,50 99,55 Q95,60 99,65 Q95,70 99,75 Q95,80 99,85" fill="none" stroke="#444" stroke-width="0.8" opacity="0.4"/>` +
        `<g opacity="0.6">` +
        `<circle cx="0" cy="0" r="4" fill="none" stroke="#777" stroke-width="1.2"/>` +
        `<circle cx="0" cy="0" r="2" fill="none" stroke="#555" stroke-width="0.8"/>` +
        `<circle cx="0" cy="0" r="0.8" fill="#888"/>` +
        `</g>` +
        `<g opacity="0.6">` +
        `<circle cx="100" cy="0" r="4" fill="none" stroke="#777" stroke-width="1.2"/>` +
        `<circle cx="100" cy="0" r="2" fill="none" stroke="#555" stroke-width="0.8"/>` +
        `<circle cx="100" cy="0" r="0.8" fill="#888"/>` +
        `</g>` +
        `<g opacity="0.6">` +
        `<circle cx="0" cy="100" r="4" fill="none" stroke="#777" stroke-width="1.2"/>` +
        `<circle cx="0" cy="100" r="2" fill="none" stroke="#555" stroke-width="0.8"/>` +
        `<circle cx="0" cy="100" r="0.8" fill="#888"/>` +
        `</g>` +
        `<g opacity="0.6">` +
        `<circle cx="100" cy="100" r="4" fill="none" stroke="#777" stroke-width="1.2"/>` +
        `<circle cx="100" cy="100" r="2" fill="none" stroke="#555" stroke-width="0.8"/>` +
        `<circle cx="100" cy="100" r="0.8" fill="#888"/>` +
        `</g>` +
        `<g opacity="0.4" stroke="#888" stroke-width="0.6" stroke-linecap="round">` +
        `<line x1="48" y1="-1" x2="52" y2="3"/>` +
        `<line x1="52" y1="-1" x2="48" y2="3"/>` +
        `<line x1="48" y1="97" x2="52" y2="101"/>` +
        `<line x1="52" y1="97" x2="48" y2="101"/>` +
        `<line x1="-1" y1="48" x2="3" y2="52"/>` +
        `<line x1="-1" y1="52" x2="3" y2="48"/>` +
        `<line x1="97" y1="48" x2="101" y2="52"/>` +
        `<line x1="97" y1="52" x2="101" y2="48"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
ShadowWeaveFrame.displayName = 'ShadowWeaveFrame';

/** SpectralEdgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SpectralEdgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#E0E8F0" stop-opacity="0.5"/>` +
        `<stop offset="0.4" stop-color="#A0B0C8" stop-opacity="0.7"/>` +
        `<stop offset="0.7" stop-color="#8090A8" stop-opacity="0.8"/>` +
        `<stop offset="1" stop-color="#E0E8F0" stop-opacity="0.5"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.15"/>` +
        `<stop offset="0.5" stop-color="#C0D0E0" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#FFFFFF" stop-opacity="0.15"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.2"/>` +
        `<stop offset="0.6" stop-color="#C0D0E0" stop-opacity="0.05"/>` +
        `<stop offset="1" stop-color="#8090A8" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<circle cx="-3" cy="40" r="12" fill="url(#c)"/>` +
        `<circle cx="50" cy="104" r="10" fill="url(#c)"/>` +
        `<circle cx="104" cy="60" r="11" fill="url(#c)"/>` +
        `<rect x="-1" y="-1" width="102" height="102" rx="${rxVal}" fill="none" stroke="#C0D0E0" stroke-width="7" opacity="0.06"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="1.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#C0D0E0" stroke-width="0.5" opacity="0.3"/>` +
        `<g opacity="0.3" fill="none" stroke="#D0E0F0" stroke-width="2.5" stroke-linecap="round">` +
        `<line x1="15" y1="-5" x2="30" y2="-5"/>` +
        `<line x1="70" y1="-5" x2="85" y2="-5"/>` +
        `<line x1="-5" y1="20" x2="-5" y2="35"/>` +
        `<line x1="105" y1="65" x2="105" y2="80"/>` +
        `<line x1="40" y1="105" x2="60" y2="105"/>` +
        `</g>` +
        `<g opacity="0.25" fill="none" stroke="#B0C0D8" stroke-width="0.6">` +
        `<path d="M-3,-3 Q2,-6 5,-3 Q2,0 -3,-3"/>` +
        `<path d="M5,-3 Q10,-7 14,-3 Q10,1 5,-3"/>` +
        `<path d="M103,-3 Q98,-6 95,-3 Q98,0 103,-3"/>` +
        `<path d="M95,-3 Q90,-7 86,-3 Q90,1 95,-3"/>` +
        `<path d="M-3,103 Q2,106 5,103 Q2,100 -3,103"/>` +
        `<path d="M5,103 Q10,107 15,103 Q10,99 5,103"/>` +
        `<path d="M103,103 Q98,106 95,103 Q98,100 103,103"/>` +
        `</g>` +
        `<g opacity="0.2" fill="none" stroke="#D0E0F0" stroke-linecap="round">` +
        `<path d="M-4,15 C5,8 2,25 8,35 C14,45 5,48 -2,55" stroke-width="1"/>` +
        `<path d="M104,25 C95,20 98,40 92,48 C86,56 95,60 103,68" stroke-width="0.9"/>` +
        `<path d="M30,-4 C25,5 35,10 32,20 C29,30 20,25 18,15" stroke-width="0.8"/>` +
        `<path d="M65,104 C70,95 60,90 63,80" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.3" stroke="#A0B0C8" stroke-width="0.5">` +
        `<line x1="45" y1="-3" x2="47" y2="-1"/>` +
        `<line x1="47" y1="-3" x2="45" y2="-1"/>` +
        `<line x1="53" y1="-3" x2="55" y2="-1"/>` +
        `<line x1="55" y1="-3" x2="53" y2="-1"/>` +
        `<line x1="-3" y1="48" x2="-1" y2="50"/>` +
        `<line x1="-1" y1="48" x2="-3" y2="50"/>` +
        `<line x1="101" y1="48" x2="103" y2="50"/>` +
        `<line x1="103" y1="48" x2="101" y2="50"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<circle cx="0" cy="0" r="3.5" fill="#D0E0F0" opacity="0.12"/>` +
        `<circle cx="0" cy="0" r="1.2" fill="#FFFFFF" opacity="0.35"/>` +
        `<circle cx="100" cy="0" r="3" fill="#D0E0F0" opacity="0.1"/>` +
        `<circle cx="100" cy="0" r="1" fill="#FFFFFF" opacity="0.3"/>` +
        `<circle cx="0" cy="100" r="2.5" fill="#D0E0F0" opacity="0.1"/>` +
        `<circle cx="0" cy="100" r="0.8" fill="#FFFFFF" opacity="0.25"/>` +
        `<circle cx="100" cy="100" r="3.2" fill="#D0E0F0" opacity="0.12"/>` +
        `<circle cx="100" cy="100" r="1.1" fill="#FFFFFF" opacity="0.3"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SpectralEdgeFrame.displayName = 'SpectralEdgeFrame';

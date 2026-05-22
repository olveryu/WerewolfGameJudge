/** FlameThornFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const FlameThornFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="1" x2="0" y2="0">` +
        `<stop offset="0" stop-color="#FF6600" stop-opacity="0.6"/>` +
        `<stop offset="0.3" stop-color="#8B2500" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#3A1000" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2A0800" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="1" x2="0" y2="0">` +
        `<stop offset="0" stop-color="#FFCC00" stop-opacity="0.4"/>` +
        `<stop offset="0.2" stop-color="#FF6600" stop-opacity="0.3"/>` +
        `<stop offset="0.5" stop-color="#CC2200" stop-opacity="0"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.5" cy="1" r="0.6">` +
        `<stop offset="0" stop-color="#FF6600" stop-opacity="0.35"/>` +
        `<stop offset="0.4" stop-color="#CC3300" stop-opacity="0.15"/>` +
        `<stop offset="1" stop-color="#3A1000" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="-8" y="-8" width="116" height="116" fill="url(#c)" rx="${rxVal}"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A0500" stroke-width="6" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2.5"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#2A0800" stroke-width="0.7" opacity="0.3"/>` +
        `<path d="M-4,102 C5,96 10,108 20,95 C28,85 32,98 42,92 C50,85 55,100 62,90 C70,82 75,96 82,88 C88,80 95,95 104,102" fill="none" stroke="#CC3300" stroke-width="2" opacity="0.4" stroke-linecap="round"/>` +
        `<path d="M0,102 C8,98 14,106 22,97 C30,88 35,100 44,93 C52,86 56,98 64,91 C72,84 77,97 84,90 C90,84 96,96 100,102" fill="none" stroke="#FF6600" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M5,102 C12,99 16,105 24,98 C32,92 38,101 46,95 C54,90 58,99 66,94 C74,88 78,98 86,93 C92,88 96,97 95,102" fill="none" stroke="#FFCC00" stroke-width="0.6" opacity="0.55" stroke-linecap="round"/>` +
        `<g opacity="0.4" fill="none" stroke-linecap="round">` +
        `<path d="M-3,90 C-8,82 2,78 -2,70" stroke="#CC3300" stroke-width="1.5"/>` +
        `<path d="M-2,65 C-6,58 1,55 -1,48" stroke="#8B2500" stroke-width="1"/>` +
        `<path d="M-1,42 C-4,36 0,33 -1,28" stroke="#5A1800" stroke-width="0.7"/>` +
        `</g>` +
        `<g opacity="0.4" fill="none" stroke-linecap="round">` +
        `<path d="M103,88 C108,80 98,76 102,68" stroke="#CC3300" stroke-width="1.5"/>` +
        `<path d="M102,62 C106,55 99,52 101,45" stroke="#8B2500" stroke-width="1"/>` +
        `<path d="M101,38 C104,32 100,28 101,22" stroke="#5A1800" stroke-width="0.7"/>` +
        `</g>` +
        `<g opacity="0.15" fill="none" stroke="#FF6600" stroke-width="0.5">` +
        `<path d="M10,-2 Q20,-5 30,-2 Q40,-4 50,-2 Q60,-5 70,-2 Q80,-4 90,-2"/>` +
        `<path d="M15,-4 Q25,-7 35,-4 Q45,-6 55,-4 Q65,-7 75,-4 Q85,-6 90,-4"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<circle cx="15" cy="-4" r="0.6" fill="#FF9900"/>` +
        `<circle cx="38" cy="-6" r="0.5" fill="#FFCC00"/>` +
        `<circle cx="62" cy="-5" r="0.7" fill="#FF6600"/>` +
        `<circle cx="85" cy="-4" r="0.4" fill="#FFCC00"/>` +
        `</g>` +
        `<g opacity="0.3">` +
        `<circle cx="25" cy="-7" r="0.4" fill="#808080"/>` +
        `<circle cx="50" cy="-7.5" r="0.3" fill="#A0A0A0"/>` +
        `<circle cx="75" cy="-7" r="0.35" fill="#909090"/>` +
        `</g>` +
        `<g opacity="0.25" stroke="#5A1800" stroke-width="0.4" stroke-linecap="round">` +
        `<line x1="-2" y1="85" x2="-4" y2="90"/>` +
        `<line x1="-3" y1="90" x2="-1" y2="95"/>` +
        `<line x1="102" y1="82" x2="104" y2="88"/>` +
        `<line x1="103" y1="88" x2="101" y2="94"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
FlameThornFrame.displayName = 'FlameThornFrame';

/** SerpentScaleFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SerpentScaleFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#4A8A4A" stop-opacity="0.9"/>` +
        `<stop offset="0.35" stop-color="#2A5A2A" stop-opacity="1"/>` +
        `<stop offset="0.65" stop-color="#1A3A1A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#4A8A4A" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#6AAA6A" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#2A5A2A" stop-opacity="0"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#CCFF00" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#00FF44" stop-opacity="0.6"/>` +
        `<stop offset="1" stop-color="#004400" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A1A0A" stroke-width="6" opacity="0.18"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="1.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#2A5A2A" stroke-width="0.7" opacity="0.4"/>` +
        `<path d="M-6,104 C-2,100 2,105 8,100" fill="none" stroke="#3A6A3A" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M8,100 C20,108 28,96 40,103 C52,110 60,96 72,104 C82,110 92,98 104,103" fill="none" stroke="#3A6A3A" stroke-width="2" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M104,103 C110,90 96,80 105,68 C112,56 98,46 106,35 C112,25 100,15 104,2" fill="none" stroke="#3A6A3A" stroke-width="2.2" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M104,2 C100,-2 96,0 92,-3" fill="none" stroke="#3A6A3A" stroke-width="2.5" opacity="0.55" stroke-linecap="round"/>` +
        `<g opacity="0.6">` +
        `<path d="M92,-3 L84,-7 L80,-2 L84,1 L92,-3 Z" fill="#2A5A2A" stroke="#4A8A4A" stroke-width="0.5"/>` +
        `<circle cx="87" cy="-3" r="2" fill="url(#c)"/>` +
        `<path d="M87,-4.5 Q87.5,-3 87,-1.5" fill="none" stroke="#001A00" stroke-width="0.5"/>` +
        `<path d="M80,-2 L76,-1 L74,-3 M76,-1 L74,1" fill="none" stroke="#CC3333" stroke-width="0.4" stroke-linecap="round"/>` +
        `</g>` +
        `<g opacity="0.3" fill="none" stroke="#5AAA5A" stroke-width="0.5">` +
        `<path d="M15,101 Q20,105 25,101"/>` +
        `<path d="M25,102 Q30,106 35,102"/>` +
        `<path d="M38,101 Q43,105 48,101"/>` +
        `<path d="M50,103 Q55,107 60,103"/>` +
        `<path d="M62,102 Q67,106 72,102"/>` +
        `<path d="M75,103 Q80,107 85,103"/>` +
        `<path d="M88,102 Q93,106 98,102"/>` +
        `</g>` +
        `<g opacity="0.25" fill="none" stroke="#5AAA5A" stroke-width="0.5">` +
        `<path d="M103,90 Q107,85 103,80"/>` +
        `<path d="M104,75 Q108,70 104,65"/>` +
        `<path d="M105,60 Q109,55 105,50"/>` +
        `<path d="M104,44 Q108,39 104,34"/>` +
        `<path d="M105,28 Q109,23 105,18"/>` +
        `<path d="M104,12 Q108,7 104,2"/>` +
        `</g>` +
        `<path d="M-4,-1 C10,-6 20,0 30,-3 C40,-7 50,0 60,-2 C70,-5 78,0 82,-2" fill="none" stroke="#2A5A2A" stroke-width="1" opacity="0.25" stroke-linecap="round"/>` +
        `<path d="M-3,10 C-6,22 0,32 -2,42 C-5,52 0,62 -2,72 C-4,82 0,90 -4,96" fill="none" stroke="#2A5A2A" stroke-width="0.8" opacity="0.2" stroke-linecap="round"/>` +
        `<g opacity="0.15" stroke="#6AAA6A" stroke-width="0.3">` +
        `<path d="M40,102 L40,105"/>` +
        `<path d="M60,101 L60,104"/>` +
        `<path d="M104,68 L107,68"/>` +
        `<path d="M104,45 L107,45"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SerpentScaleFrame.displayName = 'SerpentScaleFrame';

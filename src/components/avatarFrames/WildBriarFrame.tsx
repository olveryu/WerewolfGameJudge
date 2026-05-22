/** WildBriarFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const WildBriarFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#5A4030" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#3A2818" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#5A4030" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#6A4830" stop-opacity="0.3"/>` +
        `<stop offset="0.5" stop-color="#3A2818" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#6A4830" stop-opacity="0.3"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#150A05" stroke-width="6" opacity="0.18"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="1.8"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#3A2818" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M-4,100 C8,108 18,96 30,102 C42,108 55,95 68,102 C78,107 90,97 104,100" fill="none" stroke="#4A3420" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M104,100 C108,88 96,78 103,65 C110,52 96,42 103,30 C108,20 98,10 104,0" fill="none" stroke="#4A3420" stroke-width="1.8" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M104,0 C92,-6 82,4 70,-2 C58,-8 48,2 38,-3 C28,-8 15,2 -4,0" fill="none" stroke="#4A3420" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-4,0 C-8,12 4,22 -3,35 C-10,48 4,58 -3,70 C-8,80 2,90 -4,100" fill="none" stroke="#4A3420" stroke-width="1.8" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M-2,-2 C-5,-6 3,-8 5,-4 C7,0 -1,3 -3,0 C-5,-3 1,-5 -2,-2 Z" fill="#3A2818" fill-opacity="0.25" stroke="#5A4030" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M102,-2 C105,-6 97,-8 95,-4 C93,0 101,3 103,0 C105,-3 99,-5 102,-2 Z" fill="#3A2818" fill-opacity="0.25" stroke="#5A4030" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M-2,102 C-5,106 3,108 5,104 C7,100 -1,97 -3,100 C-5,103 1,105 -2,102 Z" fill="#3A2818" fill-opacity="0.25" stroke="#5A4030" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M102,102 C105,106 97,108 95,104 C93,100 101,97 103,100 C105,103 99,105 102,102 Z" fill="#3A2818" fill-opacity="0.25" stroke="#5A4030" stroke-width="0.8" opacity="0.5"/>` +
        `<g opacity="0.6" fill="#5A3820" stroke="#3A2010" stroke-width="0.3">` +
        `<path d="M20,-4 L22,-8 L24,-3 Z"/>` +
        `<path d="M42,-1 L44,-6 L46,-1 Z"/>` +
        `<path d="M62,-3 L64,-8 L66,-2 Z"/>` +
        `<path d="M82,-1 L84,-5 L86,-1 Z"/>` +
        `<path d="M25,104 L27,108 L29,103 Z"/>` +
        `<path d="M50,102 L52,107 L54,101 Z"/>` +
        `<path d="M75,104 L77,108 L79,103 Z"/>` +
        `<path d="M-4,28 L-8,30 L-3,32 Z"/>` +
        `<path d="M-2,58 L-7,60 L-2,62 Z"/>` +
        `<path d="M104,35 L108,37 L103,39 Z"/>` +
        `<path d="M103,72 L107,74 L102,76 Z"/>` +
        `</g>` +
        `<g opacity="0.6">` +
        `<circle cx="52" cy="-4" r="2.2" fill="#8B2252"/>` +
        `<circle cx="55" cy="-5.5" r="1.8" fill="#9B3262"/>` +
        `<circle cx="49" cy="-5" r="1.5" fill="#7B1242"/>` +
        `<circle cx="52" cy="-4.5" r="0.5" fill="#BB5588"/>` +
        `<circle cx="55" cy="-5.8" r="0.4" fill="#BB5588"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<circle cx="-4.5" cy="45" r="2" fill="#8B2252"/>` +
        `<circle cx="-6" cy="48" r="1.6" fill="#7B1242"/>` +
        `<circle cx="-3.5" cy="48.5" r="1.4" fill="#9B3262"/>` +
        `<circle cx="-4.8" cy="45.5" r="0.4" fill="#BB5588"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<circle cx="104" cy="55" r="2" fill="#8B2252"/>` +
        `<circle cx="106" cy="52" r="1.7" fill="#9B3262"/>` +
        `<circle cx="104.5" cy="55.5" r="0.4" fill="#BB5588"/>` +
        `</g>` +
        `<g opacity="0.45" fill="#3A5520" stroke="#2A4010" stroke-width="0.3">` +
        `<path d="M32,-5 Q34,-8 36,-5 Q34,-3 32,-5 Z"/>` +
        `<path d="M-5,72 Q-8,74 -5,76 Q-3,74 -5,72 Z"/>` +
        `<path d="M106,42 Q108,44 106,46 Q104,44 106,42 Z"/>` +
        `<path d="M68,105 Q70,108 72,105 Q70,103 68,105 Z"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
WildBriarFrame.displayName = 'WildBriarFrame';

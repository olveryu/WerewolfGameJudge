/** NightBloomFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const NightBloomFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#1A1A40" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#0D0D25" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#1A1A40" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<radialGradient id="b" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#FFE0A0" stop-opacity="0.8"/>` +
        `<stop offset="0.4" stop-color="#FFAA60" stop-opacity="0.4"/>` +
        `<stop offset="1" stop-color="#FF60A0" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<radialGradient id="c" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#E0F0FF" stop-opacity="0.8"/>` +
        `<stop offset="0.4" stop-color="#60A0FF" stop-opacity="0.4"/>` +
        `<stop offset="1" stop-color="#2040A0" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#050510" stroke-width="6" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#1A1A40" stroke-width="0.6" opacity="0.4"/>` +
        `<g opacity="0.55">` +
        `<path d="M-2,-2 Q-8,-8 -2,-8 Q-2,-8 -2,-2 Z" fill="#FF60A0" fill-opacity="0.4"/>` +
        `<path d="M-2,-2 Q-8,-2 -8,2 Q-4,2 -2,-2 Z" fill="#FF80C0" fill-opacity="0.35"/>` +
        `<path d="M-2,-2 Q-4,4 -8,2 Q-6,-2 -2,-2 Z" fill="#E060A0" fill-opacity="0.3"/>` +
        `<path d="M-2,-2 Q4,-8 2,-4 Q0,-2 -2,-2 Z" fill="#FF60A0" fill-opacity="0.4"/>` +
        `<path d="M-2,-2 Q2,2 -2,4 Q-4,0 -2,-2 Z" fill="#FF80C0" fill-opacity="0.3"/>` +
        `<path d="M-2,-2 Q-6,-6 -4,0 Q-2,0 -2,-2 Z" fill="#E060A0" fill-opacity="0.25"/>` +
        `<circle cx="-2" cy="-2" r="2.5" fill="url(#b)"/>` +
        `<circle cx="-2" cy="-2" r="0.8" fill="#FFE0A0" opacity="0.7"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M102,-2 Q108,-8 106,-2 Q106,0 102,-2 Z" fill="#60A0FF" fill-opacity="0.4"/>` +
        `<path d="M102,-2 Q96,-8 98,-4 Q100,-2 102,-2 Z" fill="#80C0FF" fill-opacity="0.35"/>` +
        `<path d="M102,-2 Q108,0 106,4 Q104,0 102,-2 Z" fill="#60A0FF" fill-opacity="0.3"/>` +
        `<path d="M102,-2 Q98,2 100,4 Q102,0 102,-2 Z" fill="#80C0FF" fill-opacity="0.3"/>` +
        `<path d="M102,-2 Q104,-6 106,-4 Q104,-2 102,-2 Z" fill="#6080FF" fill-opacity="0.25"/>` +
        `<circle cx="102" cy="-2" r="2.2" fill="url(#c)"/>` +
        `<circle cx="102" cy="-2" r="0.7" fill="#E0F0FF" opacity="0.7"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M-2,102 Q-8,96 -6,100 Q-4,102 -2,102 Z" fill="#C060A0" fill-opacity="0.4"/>` +
        `<path d="M-2,102 Q-8,106 -6,104 Q-4,102 -2,102 Z" fill="#FF60A0" fill-opacity="0.35"/>` +
        `<path d="M-2,102 Q2,96 0,100 Q0,102 -2,102 Z" fill="#E060A0" fill-opacity="0.3"/>` +
        `<path d="M-2,102 Q4,104 2,108 Q0,104 -2,102 Z" fill="#C060C0" fill-opacity="0.3"/>` +
        `<path d="M-2,102 Q-6,108 -4,106 Q-2,104 -2,102 Z" fill="#FF60A0" fill-opacity="0.25"/>` +
        `<path d="M-2,102 Q-8,100 -6,98 Q-4,100 -2,102 Z" fill="#C080C0" fill-opacity="0.25"/>` +
        `<path d="M-2,102 Q0,108 2,106 Q0,104 -2,102 Z" fill="#E060A0" fill-opacity="0.2"/>` +
        `<circle cx="-2" cy="102" r="2.8" fill="url(#b)"/>` +
        `<circle cx="-2" cy="102" r="0.9" fill="#FFE0A0" opacity="0.6"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<path d="M102,102 Q108,96 106,100 Q104,102 102,102 Z" fill="#60A0FF" fill-opacity="0.4"/>` +
        `<path d="M102,102 Q108,106 106,104 Q104,102 102,102 Z" fill="#80C0FF" fill-opacity="0.35"/>` +
        `<path d="M102,102 Q96,96 98,100 Q100,102 102,102 Z" fill="#60A0FF" fill-opacity="0.3"/>` +
        `<path d="M102,102 Q96,106 98,104 Q100,102 102,102 Z" fill="#80C0FF" fill-opacity="0.3"/>` +
        `<path d="M102,102 Q106,100 108,102 Q104,104 102,102 Z" fill="#6080FF" fill-opacity="0.25"/>` +
        `<path d="M102,102 Q100,108 102,106 Q104,104 102,102 Z" fill="#80C0FF" fill-opacity="0.2"/>` +
        `<circle cx="102" cy="102" r="2.4" fill="url(#c)"/>` +
        `<circle cx="102" cy="102" r="0.7" fill="#E0F0FF" opacity="0.6"/>` +
        `</g>` +
        `<g opacity="0.3" fill="none" stroke="#2A4030" stroke-width="0.5" stroke-linecap="round">` +
        `<path d="M5,-2 Q20,-5 40,-2 Q60,-4 95,-2"/>` +
        `<path d="M-2,5 Q-4,25 -2,50 Q-4,75 -2,95"/>` +
        `<path d="M5,102 Q25,105 50,102 Q75,104 95,102"/>` +
        `<path d="M102,5 Q104,25 102,50 Q104,75 102,95"/>` +
        `</g>` +
        `<g opacity="0.3">` +
        `<path d="M30,-4 Q32,-6 34,-3 Q32,-2 30,-4 Z" fill="#FF80C0"/>` +
        `<path d="M70,-3 Q72,-5 74,-2 Q72,-1 70,-3 Z" fill="#80C0FF"/>` +
        `<path d="M-4,40 Q-6,42 -3,44 Q-2,42 -4,40 Z" fill="#FF60A0"/>` +
        `<path d="M104,65 Q106,67 103,69 Q102,67 104,65 Z" fill="#60A0FF"/>` +
        `<path d="M40,104 Q42,106 44,103 Q42,102 40,104 Z" fill="#C060C0"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<circle cx="20" cy="-3" r="0.5" fill="#FFB0D0"/>` +
        `<circle cx="50" cy="-4" r="0.4" fill="#B0D0FF"/>` +
        `<circle cx="80" cy="-3" r="0.5" fill="#FFB0D0"/>` +
        `<circle cx="-3" cy="30" r="0.4" fill="#FF80C0"/>` +
        `<circle cx="-3" cy="70" r="0.5" fill="#80C0FF"/>` +
        `<circle cx="103" cy="20" r="0.4" fill="#80C0FF"/>` +
        `<circle cx="103" cy="80" r="0.5" fill="#FFB0D0"/>` +
        `<circle cx="30" cy="104" r="0.4" fill="#FF80C0"/>` +
        `<circle cx="70" cy="104" r="0.5" fill="#B0D0FF"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
NightBloomFrame.displayName = 'NightBloomFrame';

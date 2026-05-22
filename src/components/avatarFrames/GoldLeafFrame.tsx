/** GoldLeafFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const GoldLeafFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FFD700" stop-opacity="0.85"/>` +
        `<stop offset="0.3" stop-color="#DAA520" stop-opacity="1"/>` +
        `<stop offset="0.5" stop-color="#B8860B" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#DAA520" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#FFD700" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#FFF8DC" stop-opacity="0.3"/>` +
        `<stop offset="0.3" stop-color="#FFD700" stop-opacity="0"/>` +
        `<stop offset="0.7" stop-color="#FFD700" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#FFF8DC" stop-opacity="0.3"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.4" cy="0.4" r="0.5">` +
        `<stop offset="0" stop-color="#FFF8DC" stop-opacity="0.5"/>` +
        `<stop offset="0.6" stop-color="#B8860B" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#8B6914" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#3A2800" stroke-width="6" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#B8860B" stroke-width="0.8" opacity="0.4"/>` +
        `<rect x="8" y="8" width="84" height="84" rx="${Math.max(rxVal - 7, 0)}" fill="none" stroke="#DAA520" stroke-width="0.4" opacity="0.25"/>` +
        `<g>` +
        `<circle cx="15" cy="-1" r="2" fill="url(#c)"/>` +
        `<circle cx="32" cy="-2" r="1.5" fill="url(#c)"/>` +
        `<circle cx="50" cy="-1" r="2.2" fill="url(#c)"/>` +
        `<circle cx="68" cy="-2" r="1.8" fill="url(#c)"/>` +
        `<circle cx="85" cy="-1" r="1.6" fill="url(#c)"/>` +
        `<circle cx="20" cy="101" r="1.8" fill="url(#c)"/>` +
        `<circle cx="42" cy="102" r="2" fill="url(#c)"/>` +
        `<circle cx="62" cy="101" r="1.5" fill="url(#c)"/>` +
        `<circle cx="80" cy="102" r="2" fill="url(#c)"/>` +
        `<circle cx="-1" cy="18" r="1.5" fill="url(#c)"/>` +
        `<circle cx="-2" cy="40" r="2" fill="url(#c)"/>` +
        `<circle cx="-1" cy="62" r="1.8" fill="url(#c)"/>` +
        `<circle cx="-2" cy="82" r="1.5" fill="url(#c)"/>` +
        `<circle cx="101" cy="22" r="1.8" fill="url(#c)"/>` +
        `<circle cx="102" cy="48" r="2" fill="url(#c)"/>` +
        `<circle cx="101" cy="72" r="1.6" fill="url(#c)"/>` +
        `<circle cx="102" cy="88" r="1.8" fill="url(#c)"/>` +
        `</g>` +
        `<g opacity="0.55" fill="none" stroke="#B8860B" stroke-width="0.7" stroke-linecap="round">` +
        `<path d="M-4,-2 C-2,-8 4,-6 6,-2 C8,2 4,6 0,4"/>` +
        `<path d="M0,4 C-2,2 -4,4 -4,6"/>` +
        `<path d="M6,-2 C8,-4 10,-2 8,0"/>` +
        `</g>` +
        `<g opacity="0.55" fill="none" stroke="#B8860B" stroke-width="0.7" stroke-linecap="round">` +
        `<path d="M104,-2 C102,-8 96,-6 94,-2 C92,2 96,6 100,4"/>` +
        `<path d="M100,4 C102,2 104,4 104,6"/>` +
        `<path d="M94,-2 C92,-4 90,-2 92,0"/>` +
        `</g>` +
        `<g opacity="0.5" fill="none" stroke="#B8860B" stroke-width="0.7" stroke-linecap="round">` +
        `<path d="M-4,102 C-2,108 4,106 6,102 C8,98 4,94 0,96"/>` +
        `<path d="M0,96 C-2,98 -4,96 -4,94"/>` +
        `<path d="M6,102 C8,104 10,102 8,100"/>` +
        `</g>` +
        `<g opacity="0.5" fill="none" stroke="#B8860B" stroke-width="0.7" stroke-linecap="round">` +
        `<path d="M104,102 C102,108 96,106 94,102 C92,98 96,94 100,96"/>` +
        `<path d="M100,96 C102,98 104,96 104,94"/>` +
        `<path d="M94,102 C92,104 90,102 92,100"/>` +
        `</g>` +
        `<g opacity="0.2" fill="none" stroke="#8B6914" stroke-width="0.5">` +
        `<path d="M10,-5 L13,-4 L14,-6 L18,-4 L20,-5.5 L25,-4 L28,-6 L32,-4 L35,-5"/>` +
        `<path d="M60,-5 L63,-4 L65,-6 L68,-4 L72,-5.5 L75,-4 L78,-6 L82,-4 L85,-5"/>` +
        `<path d="M15,105 L18,104 L20,106 L24,104 L28,106 L32,104 L35,105.5"/>` +
        `<path d="M65,105 L68,104 L70,106 L75,104 L78,106 L82,104.5"/>` +
        `</g>` +
        `<g opacity="0.12" stroke="#DAA520" stroke-width="0.3">` +
        `<line x1="-3" y1="50" x2="103" y2="50"/>` +
        `<line x1="50" y1="-3" x2="50" y2="103"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<circle cx="25" cy="-4" r="0.4" fill="#FFD700"/>` +
        `<circle cx="75" cy="-4" r="0.35" fill="#FFF8DC"/>` +
        `<circle cx="-4" cy="30" r="0.4" fill="#FFD700"/>` +
        `<circle cx="-4" cy="70" r="0.35" fill="#FFF8DC"/>` +
        `<circle cx="104" cy="35" r="0.4" fill="#FFD700"/>` +
        `<circle cx="104" cy="65" r="0.35" fill="#FFF8DC"/>` +
        `<circle cx="30" cy="104" r="0.4" fill="#FFD700"/>` +
        `<circle cx="70" cy="104" r="0.35" fill="#FFF8DC"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
GoldLeafFrame.displayName = 'GoldLeafFrame';

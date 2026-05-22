/** StarNebulaFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const StarNebulaFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#1A0533" stop-opacity="0.95"/>` +
        `<stop offset="0.4" stop-color="#3A1066" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#5A18AA" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<radialGradient id="b" cx="20%" cy="20%" r="40%">` +
        `<stop offset="0" stop-color="#FF6EC7" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#FF6EC7" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<radialGradient id="c" cx="80%" cy="80%" r="40%">` +
        `<stop offset="0" stop-color="#6EC7FF" stop-opacity="0.15"/>` +
        `<stop offset="1" stop-color="#6EC7FF" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="-6" y="-6" width="112" height="112" rx="${rxVal + 4}" fill="url(#b)"/>` +
        `<rect x="-6" y="-6" width="112" height="112" rx="${rxVal + 4}" fill="url(#c)"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A0015" stroke-width="5" opacity="0.3"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="4" y="4" width="92" height="92" rx="${Math.max(rxVal - 3, 0)}" fill="none" stroke="#7B3FBB" stroke-width="0.7" opacity="0.35"/>` +
        `<path d="M-4,20 Q8,10 20,-3" fill="none" stroke="#FF6EC7" stroke-width="1.2" opacity="0.25" stroke-linecap="round"/>` +
        `<path d="M-3,25 Q10,15 25,-2" fill="none" stroke="#FF8ED7" stroke-width="0.6" opacity="0.2" stroke-linecap="round"/>` +
        `<path d="M80,103 Q92,95 104,82" fill="none" stroke="#6EC7FF" stroke-width="1.2" opacity="0.25" stroke-linecap="round"/>` +
        `<path d="M75,104 Q88,97 103,87" fill="none" stroke="#8ED7FF" stroke-width="0.6" opacity="0.2" stroke-linecap="round"/>` +
        `<g opacity="0.7">` +
        `<path d="M-4,50 L-7,49 L-4,48 L-3,45 L-2,48 L1,49 L-2,50 L-3,53 Z" fill="#fff"/>` +
        `<path d="M104,50 L107,49 L104,48 L103,45 L102,48 L99,49 L102,50 L103,53 Z" fill="#fff"/>` +
        `</g>` +
        `<g opacity="0.6">` +
        `<path d="M50,-4 L49,-7 L48,-4 L45,-3 L48,-2 L49,1 L50,-2 L53,-3 Z" fill="#FFE4FF"/>` +
        `<path d="M50,104 L49,107 L48,104 L45,103 L48,102 L49,99 L50,102 L53,103 Z" fill="#FFE4FF"/>` +
        `</g>` +
        `<circle cx="15" cy="-5" r="1.2" fill="#fff" opacity="0.85"/>` +
        `<circle cx="35" cy="-4" r="0.7" fill="#FFE4FF" opacity="0.6"/>` +
        `<circle cx="65" cy="-6" r="1" fill="#fff" opacity="0.75"/>` +
        `<circle cx="85" cy="-3" r="0.8" fill="#E4E4FF" opacity="0.65"/>` +
        `<circle cx="-5" cy="30" r="0.9" fill="#fff" opacity="0.55"/>` +
        `<circle cx="-4" cy="70" r="1.1" fill="#FFE4FF" opacity="0.6"/>` +
        `<circle cx="-6" cy="88" r="0.6" fill="#fff" opacity="0.4"/>` +
        `<circle cx="105" cy="15" r="0.7" fill="#E4E4FF" opacity="0.5"/>` +
        `<circle cx="106" cy="42" r="0.8" fill="#fff" opacity="0.45"/>` +
        `<circle cx="104" cy="75" r="1" fill="#FFE4FF" opacity="0.55"/>` +
        `<circle cx="20" cy="105" r="0.8" fill="#fff" opacity="0.55"/>` +
        `<circle cx="55" cy="106" r="1.2" fill="#E4FFFF" opacity="0.7"/>` +
        `<circle cx="90" cy="104" r="0.6" fill="#fff" opacity="0.45"/>` +
        `<circle cx="95" cy="-3" r="0.5" fill="#fff" opacity="0.7"/>` +
        `<circle cx="97" cy="-5" r="0.3" fill="#fff" opacity="0.5"/>` +
        `<circle cx="93" cy="-5" r="0.4" fill="#FFE4FF" opacity="0.6"/>` +
        `<circle cx="0" cy="0" r="4" fill="#FF6EC7" opacity="0.08"/>` +
        `<circle cx="100" cy="0" r="4" fill="#6EC7FF" opacity="0.08"/>` +
        `<circle cx="0" cy="100" r="4" fill="#6EC7FF" opacity="0.08"/>` +
        `<circle cx="100" cy="100" r="4" fill="#FF6EC7" opacity="0.08"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
StarNebulaFrame.displayName = 'StarNebulaFrame';

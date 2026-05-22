/** LionCrestFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const LionCrestFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#8B2020" stop-opacity="0.9"/>` +
        `<stop offset="0.4" stop-color="#5A1515" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#3A0D0D" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#8B2020" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FFD700" stop-opacity="0.25"/>` +
        `<stop offset="0.35" stop-color="#DAA520" stop-opacity="0.1"/>` +
        `<stop offset="0.65" stop-color="#B8860B" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#FFD700" stop-opacity="0.25"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A0505" stroke-width="6" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#5A1515" stroke-width="0.7" opacity="0.4"/>` +
        `<g opacity="0.6">` +
        `<path d="M40,-2 L42,-7 L45,-3 L50,-10 L55,-3 L58,-7 L60,-2 L55,0 L45,0 Z" fill="#DAA520" stroke="#B8860B" stroke-width="0.4"/>` +
        `<circle cx="50" cy="-5" r="1" fill="#FF4040" stroke="#B8860B" stroke-width="0.3"/>` +
        `<circle cx="43" cy="-3.5" r="0.6" fill="#FF4040" opacity="0.7"/>` +
        `<circle cx="57" cy="-3.5" r="0.6" fill="#FF4040" opacity="0.7"/>` +
        `</g>` +
        `<path d="M92,-4 L96,-2 L8,102 L4,100 Z" fill="#DAA520" fill-opacity="0.12" stroke="#B8860B" stroke-width="0.3" opacity="0.4"/>` +
        `<g opacity="0.3" stroke="#DAA520" stroke-width="0.3">` +
        `<line x1="70" y1="18" x2="72" y2="16"/>` +
        `<line x1="50" y1="40" x2="52" y2="38"/>` +
        `<line x1="30" y1="62" x2="32" y2="60"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<path d="M-4,-4 L4,-4 L4,2 Q4,6 0,8 Q-4,6 -4,2 Z" fill="#5A1515" stroke="#DAA520" stroke-width="0.6"/>` +
        `<path d="M-1,-2 L1,-2 L1,1 L0,2.5 L-1,1 Z" fill="#DAA520" opacity="0.4"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<path d="M96,-4 L104,-4 L104,2 Q104,6 100,8 Q96,6 96,2 Z" fill="#5A1515" stroke="#DAA520" stroke-width="0.6"/>` +
        `<path d="M99,-2 L101,-2 L101,1 L100,2.5 L99,1 Z" fill="#DAA520" opacity="0.4"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M-4,96 L4,96 L4,102 Q4,106 0,108 Q-4,106 -4,102 Z" fill="#5A1515" stroke="#DAA520" stroke-width="0.6"/>` +
        `<circle cx="0" cy="100" r="1" fill="#DAA520" opacity="0.4"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M96,96 L104,96 L104,102 Q104,106 100,108 Q96,106 96,102 Z" fill="#5A1515" stroke="#DAA520" stroke-width="0.6"/>` +
        `<circle cx="100" cy="100" r="1" fill="#DAA520" opacity="0.4"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M30,102 Q28,106 32,108 L68,108 Q72,106 70,102" fill="none" stroke="#DAA520" stroke-width="0.7"/>` +
        `<path d="M32,108 Q28,110 26,107" fill="none" stroke="#B8860B" stroke-width="0.5"/>` +
        `<path d="M68,108 Q72,110 74,107" fill="none" stroke="#B8860B" stroke-width="0.5"/>` +
        `<line x1="38" y1="105" x2="62" y2="105" stroke="#DAA520" stroke-width="0.4" opacity="0.6"/>` +
        `</g>` +
        `<g opacity="0.15" stroke="#DAA520" stroke-width="0.6" stroke-linecap="round">` +
        `<line x1="-6" y1="-6" x2="15" y2="15"/>` +
        `<line x1="106" y1="-6" x2="85" y2="15"/>` +
        `<line x1="-6" y1="106" x2="15" y2="85"/>` +
        `<line x1="106" y1="106" x2="85" y2="85"/>` +
        `</g>` +
        `<g opacity="0.35" fill="#DAA520">` +
        `<path d="M-3,48 Q-5,50 -3,52 Q-1,50 -3,48 Z"/>` +
        `<path d="M103,48 Q105,50 103,52 Q101,50 103,48 Z"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
LionCrestFrame.displayName = 'LionCrestFrame';

/** CoralReefFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const CoralReefFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#FF7F50" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#E0604A" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#20B2AA" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `<radialGradient id="b" cx="50%" cy="100%" r="50%">` +
        `<stop offset="0" stop-color="#20B2AA" stop-opacity="0.15"/>` +
        `<stop offset="1" stop-color="#20B2AA" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="-6" y="-6" width="112" height="112" rx="${rxVal + 4}" fill="url(#b)"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#102020" stroke-width="5" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#40E0D0" stroke-width="0.7" opacity="0.3"/>` +
        `<g opacity="0.75" stroke-linecap="round">` +
        `<path d="M20,-2 Q17,-7 15,-10" fill="none" stroke="#FF7F50" stroke-width="1.5"/>` +
        `<path d="M15,-10 Q13,-12 10,-11" fill="none" stroke="#FF6347" stroke-width="1"/>` +
        `<path d="M15,-10 Q16,-13 18,-12" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `<path d="M20,-2 Q23,-8 25,-10" fill="none" stroke="#FF8C66" stroke-width="1.2"/>` +
        `<path d="M25,-10 Q27,-12 29,-11" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.75" stroke-linecap="round">` +
        `<path d="M75,-2 Q78,-7 80,-10" fill="none" stroke="#FF7F50" stroke-width="1.5"/>` +
        `<path d="M80,-10 Q82,-12 84,-11" fill="none" stroke="#FF6347" stroke-width="1"/>` +
        `<path d="M80,-10 Q79,-13 77,-12" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `<path d="M75,-2 Q72,-7 70,-9" fill="none" stroke="#FF8C66" stroke-width="1.2"/>` +
        `</g>` +
        `<g opacity="0.7" stroke-linecap="round">` +
        `<path d="M35,102 Q32,107 30,110" fill="none" stroke="#FF7F50" stroke-width="1.4"/>` +
        `<path d="M30,110 Q28,112 26,111" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `<path d="M30,110 Q31,113 33,112" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `<path d="M65,102 Q68,107 70,110" fill="none" stroke="#FF8C66" stroke-width="1.3"/>` +
        `<path d="M70,110 Q72,112 74,111" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.65" stroke-linecap="round">` +
        `<path d="M-2,30 Q-7,28 -9,25" fill="none" stroke="#FF7F50" stroke-width="1.2"/>` +
        `<path d="M-9,25 Q-11,23 -10,21" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `<path d="M102,70 Q107,68 109,65" fill="none" stroke="#FF7F50" stroke-width="1.2"/>` +
        `<path d="M109,65 Q111,63 110,61" fill="none" stroke="#FF6347" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<circle cx="12" cy="-4" r="2.5" fill="none" stroke="#40E0D0" stroke-width="0.6"/>` +
        `<circle cx="11.5" cy="-4.8" r="0.5" fill="#80FFF0" opacity="0.7"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<circle cx="88" cy="105" r="3" fill="none" stroke="#40E0D0" stroke-width="0.7"/>` +
        `<circle cx="87.3" cy="104" r="0.6" fill="#80FFF0" opacity="0.7"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<circle cx="-5" cy="55" r="2" fill="none" stroke="#48D1CC" stroke-width="0.5"/>` +
        `<circle cx="-5.5" cy="54.3" r="0.4" fill="#80FFF0" opacity="0.6"/>` +
        `</g>` +
        `<circle cx="106" cy="35" r="1.5" fill="none" stroke="#48D1CC" stroke-width="0.4" opacity="0.35"/>` +
        `<circle cx="45" cy="-6" r="1.2" fill="none" stroke="#40E0D0" stroke-width="0.4" opacity="0.35"/>` +
        `<circle cx="55" cy="107" r="1.8" fill="none" stroke="#40E0D0" stroke-width="0.5" opacity="0.4"/>` +
        `<circle cx="8" cy="103" r="0.6" fill="#FF7F50" opacity="0.3"/>` +
        `<circle cx="92" cy="104" r="0.5" fill="#FF8C66" opacity="0.25"/>` +
        `<g opacity="0.45">` +
        `<path d="M-5,-8 L-4,-6 L-2,-6 L-3.5,-4.5 L-3,-2.5 L-5,-3.8 L-7,-2.5 L-6.5,-4.5 L-8,-6 L-6,-6 Z" fill="#FFD700"/>` +
        `</g>` +
        `<g opacity="0.35">` +
        `<path d="M106,103.5 L106.8,105.2 L108.5,105.2 L107.2,106.4 L107.6,108 L106,107 L104.4,108 L104.8,106.4 L103.5,105.2 L105.2,105.2 Z" fill="#FFD700"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
CoralReefFrame.displayName = 'CoralReefFrame';

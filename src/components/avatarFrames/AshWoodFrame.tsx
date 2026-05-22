/** AshWoodFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const AshWoodFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#4A4040" stop-opacity="0.9"/>` +
        `<stop offset="0.4" stop-color="#2A2424" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#1A1515" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#4A4040" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#5A4A3A" stop-opacity="0.3"/>` +
        `<stop offset="0.5" stop-color="#3A2A1A" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#5A4A3A" stop-opacity="0.3"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#FF4400" stop-opacity="0.2"/>` +
        `<stop offset="0.5" stop-color="#331100" stop-opacity="0.1"/>` +
        `<stop offset="1" stop-color="#1A1515" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#080505" stroke-width="6" opacity="0.22"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="1.5"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#2A2424" stroke-width="0.7" opacity="0.35"/>` +
        `<circle cx="0" cy="0" r="12" fill="url(#c)"/>` +
        `<circle cx="100" cy="0" r="10" fill="url(#c)"/>` +
        `<circle cx="0" cy="100" r="11" fill="url(#c)"/>` +
        `<circle cx="100" cy="100" r="13" fill="url(#c)"/>` +
        `<g opacity="0.5">` +
        `<path d="M8,-4 L35,-4 L36,-3 L35,-1 L8,-1 L7,-2.5 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M40,-4 L65,-4.5 L66,-3 L65,-1 L40,-1 L39,-2.5 Z" fill="#332828" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M70,-4 L92,-3.5 L93,-2 L92,-1 L70,-1.5 L69,-3 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `</g>` +
        `<g opacity="0.5">` +
        `<path d="M10,101 L48,101.5 L49,103 L48,105 L10,104.5 L9,103 Z" fill="#332828" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M55,101 L90,101.5 L91,103 L90,105 L55,104 L54,102.5 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<path d="M-4,10 L-4,45 L-2.5,46 L-1,45 L-1,10 L-2.5,9 Z" fill="#332828" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M-4,52 L-4,88 L-2.5,89 L-1,88 L-1,52 L-2.5,51 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<path d="M101,8 L101,35 L103,36 L105,35 L105,8 L103,7 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M101,42 L101,68 L103,69 L105,68 L105,42 L103,41 Z" fill="#332828" stroke="#4A4040" stroke-width="0.3"/>` +
        `<path d="M101,75 L101,92 L103,93 L105,92 L105,75 L103,74 Z" fill="#3A3030" stroke="#4A4040" stroke-width="0.3"/>` +
        `</g>` +
        `<g opacity="0.2" fill="none" stroke="#5A5050" stroke-width="0.3" stroke-linecap="round">` +
        `<line x1="12" y1="-3" x2="15" y2="-1.5"/>` +
        `<line x1="20" y1="-3.5" x2="24" y2="-1.5"/>` +
        `<line x1="45" y1="-3" x2="48" y2="-1.5"/>` +
        `<line x1="55" y1="-4" x2="58" y2="-1.5"/>` +
        `<line x1="75" y1="-3" x2="78" y2="-1.5"/>` +
        `<line x1="85" y1="-3.5" x2="88" y2="-2"/>` +
        `<line x1="-3.5" y1="18" x2="-1.5" y2="20"/>` +
        `<line x1="-3" y1="32" x2="-1.5" y2="34"/>` +
        `<line x1="-3.5" y1="60" x2="-1.5" y2="62"/>` +
        `<line x1="-3" y1="78" x2="-1.5" y2="80"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<circle cx="52" cy="-2.5" r="1.8" fill="#1A1515"/>` +
        `<circle cx="52" cy="-2.5" r="1.8" fill="none" stroke="#3A3030" stroke-width="0.3"/>` +
        `<circle cx="52" cy="-2.5" r="1" fill="none" stroke="#2A2424" stroke-width="0.2"/>` +
        `<circle cx="-2.5" cy="40" r="1.5" fill="#1A1515"/>` +
        `<circle cx="-2.5" cy="40" r="1.5" fill="none" stroke="#3A3030" stroke-width="0.3"/>` +
        `<circle cx="-2.5" cy="40" r="0.8" fill="none" stroke="#2A2424" stroke-width="0.2"/>` +
        `<circle cx="103" cy="58" r="1.3" fill="#1A1515"/>` +
        `<circle cx="103" cy="58" r="1.3" fill="none" stroke="#3A3030" stroke-width="0.3"/>` +
        `</g>` +
        `<g opacity="0.2" fill="none" stroke="#5A4A3A" stroke-width="0.4">` +
        `<path d="M8,-4.5 C12,-5 16,-4.5 20,-5.5 C24,-5 28,-5.5 32,-4.5 L35,-4.5"/>` +
        `<path d="M55,104.5 C60,105.5 65,104.5 70,105.5 C75,105 80,105.5 85,104.5 L90,105"/>` +
        `</g>` +
        `<g opacity="0.35">` +
        `<circle cx="37.5" cy="-2.5" r="0.6" fill="#FF4400"/>` +
        `<circle cx="67.5" cy="-2.5" r="0.5" fill="#FF6600"/>` +
        `<circle cx="-2.5" cy="48.5" r="0.4" fill="#FF4400"/>` +
        `<circle cx="103" cy="38.5" r="0.5" fill="#FF4400"/>` +
        `<circle cx="103" cy="71.5" r="0.4" fill="#FF6600"/>` +
        `<circle cx="51.5" cy="103" r="0.5" fill="#FF4400"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
AshWoodFrame.displayName = 'AshWoodFrame';

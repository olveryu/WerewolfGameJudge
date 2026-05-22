/** SakuraDriftFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SakuraDriftFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FFB7C5" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#E88FA0" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#D06B80" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<radialGradient id="b" cx="50%" cy="50%" r="55%">` +
        `<stop offset="0.6" stop-color="#FFD1DC" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#FFB7C5" stop-opacity="0.12"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<circle cx="50" cy="50" r="58" fill="url(#b)"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#6B2030" stroke-width="4" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#FFD1DC" stroke-width="0.8" opacity="0.4"/>` +
        `<g transform="translate(-3,-3)" opacity="0.8">` +
        `<ellipse rx="4.5" ry="2" rotation="0" fill="#FFB7C5"/>` +
        `<ellipse rx="4.5" ry="2" rotation="72" fill="#FF9FB2"/>` +
        `<ellipse rx="4.5" ry="2" rotation="144" fill="#FFD1DC"/>` +
        `<ellipse rx="4.5" ry="2" rotation="216" fill="#FFB7C5"/>` +
        `<ellipse rx="4.5" ry="2" rotation="288" fill="#FF9FB2"/>` +
        `<circle r="2" fill="#D05A70"/>` +
        `<circle r="1" fill="#E8899A"/>` +
        `</g>` +
        `<g transform="translate(103,-3)" opacity="0.8">` +
        `<ellipse rx="4.5" ry="2" rotation="15" fill="#FFB7C5"/>` +
        `<ellipse rx="4.5" ry="2" rotation="87" fill="#FF9FB2"/>` +
        `<ellipse rx="4.5" ry="2" rotation="159" fill="#FFD1DC"/>` +
        `<ellipse rx="4.5" ry="2" rotation="231" fill="#FFB7C5"/>` +
        `<ellipse rx="4.5" ry="2" rotation="303" fill="#FF9FB2"/>` +
        `<circle r="2" fill="#D05A70"/>` +
        `<circle r="1" fill="#E8899A"/>` +
        `</g>` +
        `<g transform="translate(-3,103)" opacity="0.8">` +
        `<ellipse rx="4" ry="1.8" rotation="10" fill="#FFB7C5"/>` +
        `<ellipse rx="4" ry="1.8" rotation="82" fill="#FF9FB2"/>` +
        `<ellipse rx="4" ry="1.8" rotation="154" fill="#FFD1DC"/>` +
        `<ellipse rx="4" ry="1.8" rotation="226" fill="#FFB7C5"/>` +
        `<ellipse rx="4" ry="1.8" rotation="298" fill="#FF9FB2"/>` +
        `<circle r="1.8" fill="#D05A70"/>` +
        `<circle r="0.9" fill="#E8899A"/>` +
        `</g>` +
        `<g transform="translate(103,103)" opacity="0.75">` +
        `<ellipse rx="4" ry="1.8" rotation="25" fill="#FFB7C5"/>` +
        `<ellipse rx="4" ry="1.8" rotation="97" fill="#FF9FB2"/>` +
        `<ellipse rx="4" ry="1.8" rotation="169" fill="#FFD1DC"/>` +
        `<ellipse rx="4" ry="1.8" rotation="241" fill="#FFB7C5"/>` +
        `<ellipse rx="4" ry="1.8" rotation="313" fill="#FF9FB2"/>` +
        `<circle r="1.8" fill="#D05A70"/>` +
        `<circle r="0.9" fill="#E8899A"/>` +
        `</g>` +
        `<ellipse cx="30" cy="-5" rx="3.5" ry="1.4" rotation="35" fill="#FFB7C5" opacity="0.65"/>` +
        `<ellipse cx="55" cy="-4" rx="2.8" ry="1.2" rotation="-20" fill="#FFD1DC" opacity="0.55"/>` +
        `<ellipse cx="70" cy="105" rx="3.2" ry="1.3" rotation="-25" fill="#FF9FB2" opacity="0.6"/>` +
        `<ellipse cx="35" cy="106" rx="2.5" ry="1.1" rotation="50" fill="#FFB7C5" opacity="0.5"/>` +
        `<ellipse cx="-5" cy="40" rx="3" ry="1.2" rotation="60" fill="#FFD1DC" opacity="0.55"/>` +
        `<ellipse cx="-4" cy="70" rx="2.5" ry="1" rotation="-40" fill="#FF9FB2" opacity="0.5"/>` +
        `<ellipse cx="105" cy="30" rx="2.8" ry="1.2" rotation="15" fill="#FFB7C5" opacity="0.5"/>` +
        `<ellipse cx="106" cy="65" rx="3" ry="1.1" rotation="-55" fill="#FFD1DC" opacity="0.45"/>` +
        `<g opacity="0.55">` +
        `<circle cx="50" cy="-2" r="2" fill="#FFB7C5"/>` +
        `<circle cx="50" cy="-2" r="0.8" fill="#D05A70"/>` +
        `<circle cx="50" cy="102" r="2" fill="#FFB7C5"/>` +
        `<circle cx="50" cy="102" r="0.8" fill="#D05A70"/>` +
        `<circle cx="-2" cy="50" r="1.8" fill="#FF9FB2"/>` +
        `<circle cx="-2" cy="50" r="0.7" fill="#D05A70"/>` +
        `<circle cx="102" cy="50" r="1.8" fill="#FF9FB2"/>` +
        `<circle cx="102" cy="50" r="0.7" fill="#D05A70"/>` +
        `</g>` +
        `<path d="M8,0 Q15,-3 22,0" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M78,0 Q85,-3 92,0" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M8,100 Q15,103 22,100" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M78,100 Q85,103 92,100" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SakuraDriftFrame.displayName = 'SakuraDriftFrame';

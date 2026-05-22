/** CelestialRingFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const CelestialRingFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#FFD700" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#FFA500" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#FFD700" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<radialGradient id="b" cx="50%" cy="50%" r="58%">` +
        `<stop offset="0.55" stop-color="#FFD700" stop-opacity="0"/>` +
        `<stop offset="0.75" stop-color="#FFD700" stop-opacity="0.08"/>` +
        `<stop offset="0.9" stop-color="#FFD700" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#FFD700" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<circle cx="50" cy="50" r="62" fill="url(#b)"/>` +
        `<rect x="-3" y="-3" width="106" height="106" rx="${rxVal + 3}" fill="none" stroke="#FFD700" stroke-width="0.8" opacity="0.35"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#6B4E00" stroke-width="4" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#FFA500" stroke-width="0.8" opacity="0.4"/>` +
        `<g stroke="#FFD700" stroke-linecap="round" opacity="0.5">` +
        `<line x1="-1" y1="-1" x2="-7" y2="-7" stroke-width="1.2"/>` +
        `<line x1="101" y1="-1" x2="107" y2="-7" stroke-width="1.2"/>` +
        `<line x1="-1" y1="101" x2="-7" y2="107" stroke-width="1.2"/>` +
        `<line x1="101" y1="101" x2="107" y2="107" stroke-width="1.2"/>` +
        `</g>` +
        `<g stroke="#FFD700" stroke-linecap="round" opacity="0.4">` +
        `<line x1="50" y1="-1" x2="50" y2="-8" stroke-width="1"/>` +
        `<line x1="50" y1="101" x2="50" y2="108" stroke-width="1"/>` +
        `<line x1="-1" y1="50" x2="-8" y2="50" stroke-width="1"/>` +
        `<line x1="101" y1="50" x2="108" y2="50" stroke-width="1"/>` +
        `</g>` +
        `<g stroke="#FFAA00" stroke-linecap="round" opacity="0.3">` +
        `<line x1="25" y1="0" x2="24" y2="-4"/>` +
        `<line x1="75" y1="0" x2="76" y2="-4"/>` +
        `<line x1="25" y1="100" x2="24" y2="104"/>` +
        `<line x1="75" y1="100" x2="76" y2="104"/>` +
        `<line x1="0" y1="25" x2="-4" y2="24"/>` +
        `<line x1="0" y1="75" x2="-4" y2="76"/>` +
        `<line x1="100" y1="25" x2="104" y2="24"/>` +
        `<line x1="100" y1="75" x2="104" y2="76"/>` +
        `</g>` +
        `<g>` +
        `<path d="M0,-1 L-3,-5 L0,-9 L3,-5 Z" fill="#FFE066" opacity="0.7" stroke="#D4AA30" stroke-width="0.5"/>` +
        `<line x1="0" y1="-3" x2="0" y2="-7" stroke="#FFF" stroke-width="0.3" opacity="0.5"/>` +
        `</g>` +
        `<g>` +
        `<path d="M100,-1 L97,-5 L100,-9 L103,-5 Z" fill="#FFE066" opacity="0.7" stroke="#D4AA30" stroke-width="0.5"/>` +
        `<line x1="100" y1="-3" x2="100" y2="-7" stroke="#FFF" stroke-width="0.3" opacity="0.5"/>` +
        `</g>` +
        `<g>` +
        `<path d="M0,101 L-3,105 L0,109 L3,105 Z" fill="#FFE066" opacity="0.7" stroke="#D4AA30" stroke-width="0.5"/>` +
        `<line x1="0" y1="103" x2="0" y2="107" stroke="#FFF" stroke-width="0.3" opacity="0.5"/>` +
        `</g>` +
        `<g>` +
        `<path d="M100,101 L97,105 L100,109 L103,105 Z" fill="#FFE066" opacity="0.7" stroke="#D4AA30" stroke-width="0.5"/>` +
        `<line x1="100" y1="103" x2="100" y2="107" stroke="#FFF" stroke-width="0.3" opacity="0.5"/>` +
        `</g>` +
        `<circle cx="50" cy="-3" r="2" fill="#FFE066" stroke="#D4AA30" stroke-width="0.5" opacity="0.7"/>` +
        `<circle cx="50" cy="-3" r="0.7" fill="#FFF" opacity="0.5"/>` +
        `<circle cx="50" cy="103" r="2" fill="#FFE066" stroke="#D4AA30" stroke-width="0.5" opacity="0.7"/>` +
        `<circle cx="50" cy="103" r="0.7" fill="#FFF" opacity="0.5"/>` +
        `<circle cx="-3" cy="50" r="2" fill="#FFE066" stroke="#D4AA30" stroke-width="0.5" opacity="0.7"/>` +
        `<circle cx="-3" cy="50" r="0.7" fill="#FFF" opacity="0.5"/>` +
        `<circle cx="103" cy="50" r="2" fill="#FFE066" stroke="#D4AA30" stroke-width="0.5" opacity="0.7"/>` +
        `<circle cx="103" cy="50" r="0.7" fill="#FFF" opacity="0.5"/>` +
        `<path d="M0,${rxVal} Q0,0 ${rxVal},0" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.1"/>` +
        `<path d="M${100 - rxVal},0 Q100,0 100,${rxVal}" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.1"/>` +
        `<path d="M0,${100 - rxVal} Q0,100 ${rxVal},100" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.1"/>` +
        `<path d="M${100 - rxVal},100 Q100,100 100,${100 - rxVal}" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.1"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
CelestialRingFrame.displayName = 'CelestialRingFrame';

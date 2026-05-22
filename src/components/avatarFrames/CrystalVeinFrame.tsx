/** CrystalVeinFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const CrystalVeinFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#2C3E50" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#1A252F" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2C3E50" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#76D7EA" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#48C9B0" stop-opacity="0.8"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<path d="M-3,-3 L8,0 L12,5 L8,8" fill="none" stroke="url(#b)" stroke-width="1.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M-2,5 L5,3 L10,8" fill="none" stroke="#76D7EA" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M103,-3 L92,0 L88,5 L92,8" fill="none" stroke="url(#b)" stroke-width="1.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M102,5 L95,3 L90,8" fill="none" stroke="#76D7EA" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-3,103 L8,100 L12,95 L8,92" fill="none" stroke="url(#b)" stroke-width="1.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M-2,95 L5,97 L10,92" fill="none" stroke="#76D7EA" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M103,103 L92,100 L88,95 L92,92" fill="none" stroke="url(#b)" stroke-width="1.5" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M102,95 L95,97 L90,92" fill="none" stroke="#76D7EA" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M45,-3 L50,3 L55,-3" fill="none" stroke="#76D7EA" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M45,103 L50,97 L55,103" fill="none" stroke="#76D7EA" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M-3,45 L3,50 L-3,55" fill="none" stroke="#76D7EA" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M103,45 L97,50 L103,55" fill="none" stroke="#76D7EA" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<circle cx="-1" cy="-1" r="2" fill="#76D7EA" opacity="0.6"/>` +
        `<circle cx="101" cy="-1" r="2" fill="#76D7EA" opacity="0.6"/>` +
        `<circle cx="-1" cy="101" r="2" fill="#76D7EA" opacity="0.6"/>` +
        `<circle cx="101" cy="101" r="2" fill="#76D7EA" opacity="0.6"/>` +
        `<circle cx="50" cy="-2" r="1.5" fill="#48C9B0" opacity="0.7"/>` +
        `<circle cx="50" cy="102" r="1.5" fill="#48C9B0" opacity="0.7"/>` +
        `<circle cx="-2" cy="50" r="1.5" fill="#48C9B0" opacity="0.7"/>` +
        `<circle cx="102" cy="50" r="1.5" fill="#48C9B0" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
CrystalVeinFrame.displayName = 'CrystalVeinFrame';

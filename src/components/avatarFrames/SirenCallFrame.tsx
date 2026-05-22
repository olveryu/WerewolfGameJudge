/** SirenCallFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SirenCallFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#48C9B0" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#1ABC9C" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#48C9B0" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#A3E4D7" stroke-width="0.7" opacity="0.45"/>` +
        `<path d="M-2,-2 Q-6,-6 -7,0 Q-6,4 -2,2 Q0,-1 -2,-2 Z" fill="#1ABC9C" stroke="#A3E4D7" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M-4,-1 Q-5,1 -3,2" fill="none" stroke="#76D7C4" stroke-width="0.5" opacity="0.6"/>` +
        `<path d="M102,-2 Q106,-6 107,0 Q106,4 102,2 Q100,-1 102,-2 Z" fill="#1ABC9C" stroke="#A3E4D7" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M104,-1 Q105,1 103,2" fill="none" stroke="#76D7C4" stroke-width="0.5" opacity="0.6"/>` +
        `<path d="M-2,102 Q-6,106 -7,100 Q-6,96 -2,98 Q0,101 -2,102 Z" fill="#1ABC9C" stroke="#A3E4D7" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M102,102 Q106,106 107,100 Q106,96 102,98 Q100,101 102,102 Z" fill="#1ABC9C" stroke="#A3E4D7" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M10,0 Q17,-5 24,0 Q31,-4 38,0 Q45,-5 52,0 Q59,-4 66,0 Q73,-5 80,0 Q87,-4 94,0" fill="none" stroke="#48C9B0" stroke-width="1.5" opacity="0.7"/>` +
        `<path d="M10,100 Q17,105 24,100 Q31,104 38,100 Q45,105 52,100 Q59,104 66,100 Q73,105 80,100 Q87,104 94,100" fill="none" stroke="#48C9B0" stroke-width="1.5" opacity="0.7"/>` +
        `<path d="M0,15 Q-4,22 0,29 Q-3,36 0,43 Q-4,50 0,57 Q-3,64 0,71 Q-4,78 0,85" fill="none" stroke="#48C9B0" stroke-width="1.3" opacity="0.6"/>` +
        `<path d="M100,15 Q104,22 100,29 Q103,36 100,43 Q104,50 100,57 Q103,64 100,71 Q104,78 100,85" fill="none" stroke="#48C9B0" stroke-width="1.3" opacity="0.6"/>` +
        `<circle cx="50" cy="-3" r="2" fill="#F0F0F0" stroke="#D5D8DC" stroke-width="0.5" opacity="0.8"/>` +
        `<circle cx="50" cy="103" r="2" fill="#F0F0F0" stroke="#D5D8DC" stroke-width="0.5" opacity="0.8"/>` +
        `<circle cx="-3" cy="50" r="1.8" fill="#F0F0F0" stroke="#D5D8DC" stroke-width="0.5" opacity="0.75"/>` +
        `<circle cx="103" cy="50" r="1.8" fill="#F0F0F0" stroke="#D5D8DC" stroke-width="0.5" opacity="0.75"/>` +
        `<circle cx="49.5" cy="-3.5" r="0.6" fill="#FFFFFF" opacity="0.7"/>` +
        `<circle cx="49.5" cy="102.5" r="0.6" fill="#FFFFFF" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SirenCallFrame.displayName = 'SirenCallFrame';

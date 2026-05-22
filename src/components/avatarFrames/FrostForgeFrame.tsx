/** FrostForgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const FrostForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#AED6F1" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#5DADE2" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#AED6F1" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A3A5C" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#D6EAF8" stroke-width="0.7" opacity="0.5"/>` +
        `<path d="M15,0 L13,-6 L17,-6 L15,-1" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M35,0 L33,-5 L37,-5 L35,-1" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M50,0 L48,-7 L52,-7 L50,-1" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M65,0 L63,-5 L67,-5 L65,-1" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M85,0 L83,-6 L87,-6 L85,-1" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M15,100 L13,106 L17,106 L15,101" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M35,100 L33,105 L37,105 L35,101" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M50,100 L48,107 L52,107 L50,101" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M65,100 L63,105 L67,105 L65,101" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M85,100 L83,106 L87,106 L85,101" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M0,20 L-6,18 L-6,22 L-1,20" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M0,45 L-5,43 L-5,47 L-1,45" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M0,70 L-6,68 L-6,72 L-1,70" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M100,20 L106,18 L106,22 L101,20" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M100,45 L105,43 L105,47 L101,45" fill="#5DADE2" stroke="#D6EAF8" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M100,70 L106,68 L106,72 L101,70" fill="#85C1E9" stroke="#D6EAF8" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M0,0 L-5,-7 L-1,-2 Z" fill="#AED6F1" opacity="0.8"/>` +
        `<path d="M2,-1 L-2,-8 L3,-3 Z" fill="#85C1E9" opacity="0.7"/>` +
        `<path d="M100,0 L105,-7 L101,-2 Z" fill="#AED6F1" opacity="0.8"/>` +
        `<path d="M98,-1 L102,-8 L97,-3 Z" fill="#85C1E9" opacity="0.7"/>` +
        `<path d="M0,100 L-5,107 L-1,102 Z" fill="#AED6F1" opacity="0.8"/>` +
        `<path d="M2,101 L-2,108 L3,103 Z" fill="#85C1E9" opacity="0.7"/>` +
        `<path d="M100,100 L105,107 L101,102 Z" fill="#AED6F1" opacity="0.8"/>` +
        `<path d="M98,101 L102,108 L97,103 Z" fill="#85C1E9" opacity="0.7"/>` +
        `<circle cx="25" cy="-3" r="1" fill="#EBF5FB" opacity="0.8"/>` +
        `<circle cx="75" cy="-3" r="1" fill="#EBF5FB" opacity="0.8"/>` +
        `<circle cx="-3" cy="35" r="1" fill="#EBF5FB" opacity="0.7"/>` +
        `<circle cx="103" cy="60" r="1" fill="#EBF5FB" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
FrostForgeFrame.displayName = 'FrostForgeFrame';

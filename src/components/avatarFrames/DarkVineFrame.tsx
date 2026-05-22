/** DarkVineFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const DarkVineFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#1A5A2A" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#0A3018" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<g opacity="0.3" stroke="#0A2010" stroke-width="2.8" fill="none">` +
        `<path d="M15,1 C22,-5 32,6 42,1 C52,-5 62,6 72,1 C80,-4 88,4 90,1"/>` +
        `<path d="M10,101 C20,106 32,94 42,101 C52,106 62,94 72,101 C82,106 92,96 95,101"/>` +
        `<path d="M1,15 C-4,25 6,35 1,45 C-4,55 6,65 1,75 C-4,82 4,88 1,90"/>` +
        `<path d="M101,10 C106,22 94,32 101,42 C106,52 94,62 101,72 C106,80 96,86 101,90"/>` +
        `</g>` +
        `<path d="M15,0 C22,-5 32,5 42,0 C52,-5 62,5 72,0 C80,-4 88,3 90,0" fill="none" stroke="#2D8B4A" stroke-width="2.5" opacity="0.85"/>` +
        `<path d="M10,100 C20,105 32,95 42,100 C52,105 62,95 72,100 C82,105 92,97 95,100" fill="none" stroke="#2D8B4A" stroke-width="2.5" opacity="0.85"/>` +
        `<path d="M0,15 C-5,25 5,35 0,45 C-5,55 5,65 0,75 C-5,82 3,88 0,90" fill="none" stroke="#2D8B4A" stroke-width="2.5" opacity="0.85"/>` +
        `<path d="M100,10 C105,22 95,32 100,42 C105,52 95,62 100,72 C105,80 97,86 100,90" fill="none" stroke="#2D8B4A" stroke-width="2.5" opacity="0.85"/>` +
        `<g opacity="0.5" stroke="#1A5A2A" stroke-width="1" fill="none" stroke-linecap="round">` +
        `<path d="M28,-1 L26,-4"/>` +
        `<path d="M60,-1 L62,-4"/>` +
        `<path d="M28,101 L26,104"/>` +
        `<path d="M60,101 L62,104"/>` +
        `<path d="M-1,28 L-4,26"/>` +
        `<path d="M-1,60 L-4,62"/>` +
        `<path d="M101,28 L104,26"/>` +
        `<path d="M101,60 L104,62"/>` +
        `</g>` +
        `<path d="M${c + 8},${c - 4} Q${c + 12},${c - 8} ${c + 10},${c - 12}" fill="none" stroke="#34D399" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M${100 - c - 8},${c - 4} Q${100 - c - 12},${c - 8} ${100 - c - 10},${c - 12}" fill="none" stroke="#34D399" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M${c + 8},${100 - c + 4} Q${c + 12},${100 - c + 8} ${c + 10},${100 - c + 12}" fill="none" stroke="#34D399" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M${100 - c - 8},${100 - c + 4} Q${100 - c - 12},${100 - c + 8} ${100 - c - 10},${100 - c + 12}" fill="none" stroke="#34D399" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M${c},${c} Q${c - 7},${c - 7} ${c},${c - 7} Q${c + 7},${c - 7} ${c},${c} Z" fill="#34D399" opacity="0.75"/>` +
        `<path d="M${c + 5},${c - 4} Q${c + 3},${c - 9} ${c + 8},${c - 7} Z" fill="#2AAA70" opacity="0.55"/>` +
        `<path d="M${100 - c},${c} Q${100 - c + 7},${c - 7} ${100 - c},${c - 7} Q${100 - c - 7},${c - 7} ${100 - c},${c} Z" fill="#34D399" opacity="0.75"/>` +
        `<path d="M${100 - c - 5},${c - 4} Q${100 - c - 3},${c - 9} ${100 - c - 8},${c - 7} Z" fill="#2AAA70" opacity="0.55"/>` +
        `<path d="M${c},${100 - c} Q${c - 7},${100 - c + 7} ${c},${100 - c + 7} Q${c + 7},${100 - c + 7} ${c},${100 - c} Z" fill="#34D399" opacity="0.75"/>` +
        `<path d="M${c + 5},${100 - c + 4} Q${c + 3},${100 - c + 9} ${c + 8},${100 - c + 7} Z" fill="#2AAA70" opacity="0.55"/>` +
        `<path d="M${100 - c},${100 - c} Q${100 - c + 7},${100 - c + 7} ${100 - c},${100 - c + 7} Q${100 - c - 7},${100 - c + 7} ${100 - c},${100 - c} Z" fill="#34D399" opacity="0.75"/>` +
        `<path d="M${100 - c - 5},${100 - c + 4} Q${100 - c - 3},${100 - c + 9} ${100 - c - 8},${100 - c + 7} Z" fill="#2AAA70" opacity="0.55"/>` +
        `<circle cx="25" cy="-2" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `<circle cx="50" cy="-3" r="1.5" fill="#A02020" opacity="0.6"/>` +
        `<circle cx="75" cy="-2" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `<circle cx="25" cy="102" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `<circle cx="55" cy="103" r="1.5" fill="#A02020" opacity="0.6"/>` +
        `<circle cx="75" cy="102" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `<circle cx="-2" cy="40" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `<circle cx="102" cy="60" r="2" fill="#8B1A1A" opacity="0.75"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
DarkVineFrame.displayName = 'DarkVineFrame';

/** PharaohGoldFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const PharaohGoldFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#D4AA30" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#B8942A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#8A6E18" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="4" y="4" width="92" height="92" rx="${Math.max(rxVal - 3, 0)}" fill="none" stroke="#B8942A" stroke-width="1.5" opacity="0.8"/>` +
        `<rect x="8" y="8" width="84" height="84" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#8A6E18" stroke-width="1" opacity="0.6"/>` +
        `<path d="M${c - 3},${c - 3} L${c + 14},${c - 3} L${c - 3},${c + 14} Z" fill="#D4AA30" opacity="0.6"/>` +
        `<path d="M${100 - c - 14},${c - 3} L${100 - c + 3},${c - 3} L${100 - c + 3},${c + 14} Z" fill="#D4AA30" opacity="0.6"/>` +
        `<path d="M${c - 3},${100 - c - 14} L${c - 3},${100 - c + 3} L${c + 14},${100 - c + 3} Z" fill="#D4AA30" opacity="0.6"/>` +
        `<path d="M${100 - c - 14},${100 - c + 3} L${100 - c + 3},${100 - c + 3} L${100 - c + 3},${100 - c - 14} Z" fill="#D4AA30" opacity="0.6"/>` +
        `<path d="M${c + 4},${c + 4} L${c + 10},${c + 4} L${c + 4},${c + 10} Z" fill="#B8942A" opacity="0.4"/>` +
        `<path d="M${100 - c - 10},${c + 4} L${100 - c - 4},${c + 4} L${100 - c - 4},${c + 10} Z" fill="#B8942A" opacity="0.4"/>` +
        `<path d="M${c + 4},${100 - c - 10} L${c + 4},${100 - c - 4} L${c + 10},${100 - c - 4} Z" fill="#B8942A" opacity="0.4"/>` +
        `<path d="M${100 - c - 10},${100 - c - 4} L${100 - c - 4},${100 - c - 4} L${100 - c - 4},${100 - c - 10} Z" fill="#B8942A" opacity="0.4"/>` +
        `<g opacity="0.3" stroke="#DDBB40" stroke-width="0.6" fill="none">` +
        `<line x1="${c + 2}" y1="${c + 6}" x2="${c + 6}" y2="${c + 2}"/>` +
        `<line x1="${100 - c - 2}" y1="${c + 6}" x2="${100 - c - 6}" y2="${c + 2}"/>` +
        `<line x1="${c + 2}" y1="${100 - c - 6}" x2="${c + 6}" y2="${100 - c - 2}"/>` +
        `<line x1="${100 - c - 2}" y1="${100 - c - 6}" x2="${100 - c - 6}" y2="${100 - c - 2}"/>` +
        `</g>` +
        `<g opacity="0.7">` +
        `<circle cx="50" cy="-4" r="2.5" fill="none" stroke="#D4AA30" stroke-width="1"/>` +
        `<line x1="50" y1="-1.5" x2="50" y2="4" stroke="#D4AA30" stroke-width="1"/>` +
        `<line x1="48" y1="1" x2="52" y2="1" stroke="#D4AA30" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.7">` +
        `<circle cx="50" cy="104" r="2.5" fill="none" stroke="#D4AA30" stroke-width="1"/>` +
        `<line x1="50" y1="101.5" x2="50" y2="96" stroke="#D4AA30" stroke-width="1"/>` +
        `<line x1="48" y1="99" x2="52" y2="99" stroke="#D4AA30" stroke-width="0.8"/>` +
        `</g>` +
        `<path d="M35,0 L38,-3 L41,0" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M47,0 L50,-3 L53,0" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M59,0 L62,-3 L65,0" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M35,100 L38,103 L41,100" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M47,100 L50,103 L53,100" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M59,100 L62,103 L65,100" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M0,35 L-3,38 L0,41" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M0,59 L-3,62 L0,65" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M100,35 L103,38 L100,41" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M100,59 L103,62 L100,65" fill="none" stroke="#D4AA30" stroke-width="1.2"/>` +
        `<path d="M-4,50 L-1,47 L2,50 L-1,53 Z" fill="#DDBB40" opacity="0.8"/>` +
        `<path d="M98,50 L101,47 L104,50 L101,53 Z" fill="#DDBB40" opacity="0.8"/>` +
        `<g opacity="0.4" stroke="#D4AA30" stroke-width="0.6" stroke-linecap="round">` +
        `<line x1="-4" y1="47" x2="-6" y2="45"/>` +
        `<line x1="-4" y1="53" x2="-6" y2="55"/>` +
        `<line x1="104" y1="47" x2="106" y2="45"/>` +
        `<line x1="104" y1="53" x2="106" y2="55"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
PharaohGoldFrame.displayName = 'PharaohGoldFrame';

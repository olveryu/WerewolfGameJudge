/** RunicSealFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const RunicSealFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#7B5FBF" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#4B3F8F" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#5B4FA0" stroke-width="1" opacity="0.5"/>` +
        `<path d="M0,${rxVal} Q0,0 ${rxVal},0" fill="none" stroke="#9B8BFF" stroke-width="4" stroke-linecap="round" opacity="0.25"/>` +
        `<path d="M${100 - rxVal},0 Q100,0 100,${rxVal}" fill="none" stroke="#9B8BFF" stroke-width="4" stroke-linecap="round" opacity="0.25"/>` +
        `<path d="M0,${100 - rxVal} Q0,100 ${rxVal},100" fill="none" stroke="#9B8BFF" stroke-width="4" stroke-linecap="round" opacity="0.25"/>` +
        `<path d="M${100 - rxVal},100 Q100,100 100,${100 - rxVal}" fill="none" stroke="#9B8BFF" stroke-width="4" stroke-linecap="round" opacity="0.25"/>` +
        `<g opacity="0.75">` +
        `<line x1="18" y1="-2" x2="18" y2="4" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="16" y1="1" x2="20" y2="1" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="35" y1="-2" x2="35" y2="4" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="33" y1="1" x2="37" y2="1" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="50" y1="-2" x2="50" y2="4" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="48" y1="1" x2="52" y2="1" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="65" y1="-2" x2="65" y2="4" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="63" y1="1" x2="67" y2="1" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="82" y1="-2" x2="82" y2="4" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="80" y1="1" x2="84" y2="1" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.75">` +
        `<line x1="18" y1="96" x2="18" y2="102" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="16" y1="99" x2="20" y2="99" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="35" y1="96" x2="35" y2="102" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="50" y1="96" x2="50" y2="102" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="65" y1="96" x2="65" y2="102" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="82" y1="96" x2="82" y2="102" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="80" y1="99" x2="84" y2="99" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.75">` +
        `<line x1="-2" y1="18" x2="4" y2="18" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="1" y1="16" x2="1" y2="20" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="-2" y1="35" x2="4" y2="35" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="-2" y1="50" x2="4" y2="50" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="-2" y1="65" x2="4" y2="65" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="-2" y1="82" x2="4" y2="82" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="1" y1="80" x2="1" y2="84" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `</g>` +
        `<g opacity="0.75">` +
        `<line x1="96" y1="18" x2="102" y2="18" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="99" y1="16" x2="99" y2="20" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `<line x1="96" y1="35" x2="102" y2="35" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="96" y1="50" x2="102" y2="50" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="96" y1="65" x2="102" y2="65" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="96" y1="82" x2="102" y2="82" stroke="#9B8BFF" stroke-width="1.5"/>` +
        `<line x1="99" y1="80" x2="99" y2="84" stroke="#9B8BFF" stroke-width="0.8"/>` +
        `</g>` +
        `<circle cx="${c}" cy="${c}" r="5" fill="none" stroke="#A78BFA" stroke-width="0.8" opacity="0.35"/>` +
        `<path d="M${c - 4},${c} L${c},${c - 4} L${c + 4},${c} L${c},${c + 4} Z" fill="#A78BFA" opacity="0.9"/>` +
        `<circle cx="${100 - c}" cy="${c}" r="5" fill="none" stroke="#A78BFA" stroke-width="0.8" opacity="0.35"/>` +
        `<path d="M${100 - c - 4},${c} L${100 - c},${c - 4} L${100 - c + 4},${c} L${100 - c},${c + 4} Z" fill="#A78BFA" opacity="0.9"/>` +
        `<circle cx="${c}" cy="${100 - c}" r="5" fill="none" stroke="#A78BFA" stroke-width="0.8" opacity="0.35"/>` +
        `<path d="M${c - 4},${100 - c} L${c},${100 - c - 4} L${c + 4},${100 - c} L${c},${100 - c + 4} Z" fill="#A78BFA" opacity="0.9"/>` +
        `<circle cx="${100 - c}" cy="${100 - c}" r="5" fill="none" stroke="#A78BFA" stroke-width="0.8" opacity="0.35"/>` +
        `<path d="M${100 - c - 4},${100 - c} L${100 - c},${100 - c - 4} L${100 - c + 4},${100 - c} L${100 - c},${100 - c + 4} Z" fill="#A78BFA" opacity="0.9"/>` +
        `<circle cx="${c}" cy="${c}" r="2" fill="#BBA0FF" opacity="0.5"/>` +
        `<circle cx="${100 - c}" cy="${c}" r="2" fill="#BBA0FF" opacity="0.5"/>` +
        `<circle cx="${c}" cy="${100 - c}" r="2" fill="#BBA0FF" opacity="0.5"/>` +
        `<circle cx="${100 - c}" cy="${100 - c}" r="2" fill="#BBA0FF" opacity="0.5"/>` +
        `<path d="M50,-3 L52.5,0 L50,3 L47.5,0 Z" fill="#A78BFA" opacity="0.6"/>` +
        `<path d="M50,97 L52.5,100 L50,103 L47.5,100 Z" fill="#A78BFA" opacity="0.6"/>` +
        `<path d="M-3,50 L0,47.5 L3,50 L0,52.5 Z" fill="#A78BFA" opacity="0.6"/>` +
        `<path d="M97,50 L100,47.5 L103,50 L100,52.5 Z" fill="#A78BFA" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
RunicSealFrame.displayName = 'RunicSealFrame';

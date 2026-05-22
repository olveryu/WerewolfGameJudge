/** VoidRiftFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const VoidRiftFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<radialGradient id="a" cx="50%" cy="50%" r="70%">` +
        `<stop offset="0" stop-color="#301060" stop-opacity="0.3"/>` +
        `<stop offset="0.7" stop-color="#4A1880" stop-opacity="0.7"/>` +
        `<stop offset="1" stop-color="#6030A0" stop-opacity="0.9"/>` +
        `</radialGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#A060E0" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#6030A0" stop-opacity="0.7"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#4A1880" stroke-width="1" opacity="0.5"/>` +
        `<path d="M25,0 L23,-6 L26,-10" fill="none" stroke="#A060E0" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M60,0 L62,-8 L59,-12" fill="none" stroke="#C080FF" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M80,0 L78,-5 L81,-9" fill="none" stroke="#A060E0" stroke-width="0.8" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M40,100 L42,106 L39,110" fill="none" stroke="#A060E0" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M70,100 L68,107 L71,111" fill="none" stroke="#C080FF" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M0,35 L-6,33 L-10,36" fill="none" stroke="#A060E0" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M0,65 L-7,67 L-11,64" fill="none" stroke="#C080FF" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M100,30 L106,28 L110,31" fill="none" stroke="#A060E0" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M100,70 L107,72 L111,69" fill="none" stroke="#A060E0" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M0,0 L4,-3 L8,0 L4,3 Z" fill="#6030A0" stroke="#A060E0" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M92,0 L96,-3 L100,0 L96,3 Z" fill="#6030A0" stroke="#A060E0" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M0,100 L4,97 L8,100 L4,103 Z" fill="#6030A0" stroke="#A060E0" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M92,100 L96,97 L100,100 L96,103 Z" fill="#6030A0" stroke="#A060E0" stroke-width="0.6" opacity="0.8"/>` +
        `<circle cx="15" cy="-4" r="0.8" fill="#C080FF" opacity="0.5"/>` +
        `<circle cx="85" cy="104" r="0.8" fill="#C080FF" opacity="0.5"/>` +
        `<circle cx="-4" cy="50" r="0.6" fill="#A060E0" opacity="0.4"/>` +
        `<circle cx="104" cy="50" r="0.6" fill="#A060E0" opacity="0.4"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
VoidRiftFrame.displayName = 'VoidRiftFrame';

/** IronForgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const IronForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#8B7355" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#5A4A38" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#3A3028" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FF8C00" stop-opacity="0.5"/>` +
        `<stop offset="1" stop-color="#FF4500" stop-opacity="0.2"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M0,${rxVal} Q0,0 ${rxVal},0" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" opacity="0.4"/>` +
        `<path d="M${100 - rxVal},0 Q100,0 100,${rxVal}" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" opacity="0.4"/>` +
        `<path d="M0,${100 - rxVal} Q0,100 ${rxVal},100" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" opacity="0.4"/>` +
        `<path d="M${100 - rxVal},100 Q100,100 100,${100 - rxVal}" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" opacity="0.4"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#5A4A38" stroke-width="1.5" opacity="0.85"/>` +
        `<path d="M0,${rxVal} Q0,0 ${rxVal},0" fill="none" stroke="#A08A68" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${100 - rxVal},0 Q100,0 100,${rxVal}" fill="none" stroke="#A08A68" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M0,${100 - rxVal} Q0,100 ${rxVal},100" fill="none" stroke="#A08A68" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${100 - rxVal},100 Q100,100 100,${100 - rxVal}" fill="none" stroke="#A08A68" stroke-width="3" stroke-linecap="round"/>` +
        `<g opacity="0.35" stroke="#A08A68" stroke-width="0.8" stroke-linecap="round">` +
        `<line x1="30" y1="1" x2="34" y2="-1"/>` +
        `<line x1="66" y1="1" x2="70" y2="-1"/>` +
        `<line x1="30" y1="99" x2="34" y2="101"/>` +
        `<line x1="66" y1="99" x2="70" y2="101"/>` +
        `<line x1="1" y1="30" x2="-1" y2="34"/>` +
        `<line x1="1" y1="66" x2="-1" y2="70"/>` +
        `<line x1="99" y1="30" x2="101" y2="34"/>` +
        `<line x1="99" y1="66" x2="101" y2="70"/>` +
        `</g>` +
        `<circle cx="${c - 1}" cy="${c - 1}" r="3.5" fill="#8B7355" stroke="#2A2520" stroke-width="1"/>` +
        `<circle cx="${101 - c}" cy="${c - 1}" r="3.5" fill="#8B7355" stroke="#2A2520" stroke-width="1"/>` +
        `<circle cx="${c - 1}" cy="${101 - c}" r="3.5" fill="#8B7355" stroke="#2A2520" stroke-width="1"/>` +
        `<circle cx="${101 - c}" cy="${101 - c}" r="3.5" fill="#8B7355" stroke="#2A2520" stroke-width="1"/>` +
        `<circle cx="${c - 2}" cy="${c - 2}" r="1" fill="#B8A080" opacity="0.6"/>` +
        `<circle cx="${102 - c}" cy="${c - 2}" r="1" fill="#B8A080" opacity="0.6"/>` +
        `<circle cx="${c - 2}" cy="${102 - c}" r="1" fill="#B8A080" opacity="0.6"/>` +
        `<circle cx="${102 - c}" cy="${102 - c}" r="1" fill="#B8A080" opacity="0.6"/>` +
        `<circle cx="50" cy="-1" r="2.2" fill="#6B5A42" stroke="#2A2520" stroke-width="0.6"/>` +
        `<circle cx="50" cy="101" r="2.2" fill="#6B5A42" stroke="#2A2520" stroke-width="0.6"/>` +
        `<circle cx="-1" cy="50" r="2.2" fill="#6B5A42" stroke="#2A2520" stroke-width="0.6"/>` +
        `<circle cx="101" cy="50" r="2.2" fill="#6B5A42" stroke="#2A2520" stroke-width="0.6"/>` +
        `<circle cx="25" cy="-1" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="75" cy="-1" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="25" cy="101" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="75" cy="101" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="-1" cy="25" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="-1" cy="75" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="101" cy="25" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `<circle cx="101" cy="75" r="1.5" fill="#6B5A42" stroke="#2A2520" stroke-width="0.5"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
IronForgeFrame.displayName = 'IronForgeFrame';

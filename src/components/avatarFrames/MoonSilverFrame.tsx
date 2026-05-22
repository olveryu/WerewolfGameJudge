/** MoonSilverFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const MoonSilverFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#F0F2FF" stop-opacity="1"/>` +
        `<stop offset="0.5" stop-color="#C0C8E0" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#8090B8" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#B0B8D0" stroke-width="1.2" opacity="0.7"/>` +
        `<path d="M0,${rxVal} A${rxVal - 4},${rxVal - 4} 0 0,1 ${rxVal},0" fill="none" stroke="#F0F2FF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M4,${rxVal - 4} A${Math.max(rxVal - 8, 2)},${Math.max(rxVal - 8, 2)} 0 0,1 ${rxVal - 4},4" fill="none" stroke="#C8D0E8" stroke-width="1.5" opacity="0.7"/>` +
        `<path d="M${100 - rxVal},0 A${rxVal - 4},${rxVal - 4} 0 0,1 100,${rxVal}" fill="none" stroke="#F0F2FF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${104 - rxVal},4 A${Math.max(rxVal - 8, 2)},${Math.max(rxVal - 8, 2)} 0 0,1 96,${rxVal - 4}" fill="none" stroke="#C8D0E8" stroke-width="1.5" opacity="0.7"/>` +
        `<path d="M${rxVal},100 A${rxVal - 4},${rxVal - 4} 0 0,1 0,${100 - rxVal}" fill="none" stroke="#F0F2FF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${rxVal - 4},96 A${Math.max(rxVal - 8, 2)},${Math.max(rxVal - 8, 2)} 0 0,1 4,${104 - rxVal}" fill="none" stroke="#C8D0E8" stroke-width="1.5" opacity="0.7"/>` +
        `<path d="M100,${100 - rxVal} A${rxVal - 4},${rxVal - 4} 0 0,1 ${100 - rxVal},100" fill="none" stroke="#F0F2FF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M96,${104 - rxVal} A${Math.max(rxVal - 8, 2)},${Math.max(rxVal - 8, 2)} 0 0,1 ${104 - rxVal},96" fill="none" stroke="#C8D0E8" stroke-width="1.5" opacity="0.7"/>` +
        `<g opacity="0.4" stroke="#E8EAF8" stroke-width="0.8" stroke-linecap="round">` +
        `<line x1="${rxVal * 0.29 - 5}" y1="${rxVal * 0.29}" x2="${rxVal * 0.29 + 5}" y2="${rxVal * 0.29}"/>` +
        `<line x1="${rxVal * 0.29}" y1="${rxVal * 0.29 - 5}" x2="${rxVal * 0.29}" y2="${rxVal * 0.29 + 5}"/>` +
        `<line x1="${100 - rxVal * 0.29 - 5}" y1="${rxVal * 0.29}" x2="${100 - rxVal * 0.29 + 5}" y2="${rxVal * 0.29}"/>` +
        `<line x1="${100 - rxVal * 0.29}" y1="${rxVal * 0.29 - 5}" x2="${100 - rxVal * 0.29}" y2="${rxVal * 0.29 + 5}"/>` +
        `<line x1="${rxVal * 0.29 - 5}" y1="${100 - rxVal * 0.29}" x2="${rxVal * 0.29 + 5}" y2="${100 - rxVal * 0.29}"/>` +
        `<line x1="${rxVal * 0.29}" y1="${100 - rxVal * 0.29 - 5}" x2="${rxVal * 0.29}" y2="${100 - rxVal * 0.29 + 5}"/>` +
        `<line x1="${100 - rxVal * 0.29 - 5}" y1="${100 - rxVal * 0.29}" x2="${100 - rxVal * 0.29 + 5}" y2="${100 - rxVal * 0.29}"/>` +
        `<line x1="${100 - rxVal * 0.29}" y1="${100 - rxVal * 0.29 - 5}" x2="${100 - rxVal * 0.29}" y2="${100 - rxVal * 0.29 + 5}"/>` +
        `</g>` +
        `<path d="M50,-4 L54,0 L50,4 L46,0 Z" fill="#D8DCF0" opacity="1"/>` +
        `<path d="M50,96 L54,100 L50,104 L46,100 Z" fill="#D8DCF0" opacity="1"/>` +
        `<path d="M-4,50 L0,46 L4,50 L0,54 Z" fill="#D8DCF0" opacity="1"/>` +
        `<path d="M96,50 L100,46 L104,50 L100,54 Z" fill="#D8DCF0" opacity="1"/>` +
        `<g opacity="0.35" fill="#C8D0E8">` +
        `<circle cx="20" cy="0" r="1.2"/>` +
        `<circle cx="80" cy="0" r="1.2"/>` +
        `<circle cx="20" cy="100" r="1.2"/>` +
        `<circle cx="80" cy="100" r="1.2"/>` +
        `<circle cx="0" cy="20" r="1.2"/>` +
        `<circle cx="0" cy="80" r="1.2"/>` +
        `<circle cx="100" cy="20" r="1.2"/>` +
        `<circle cx="100" cy="80" r="1.2"/>` +
        `</g>` +
        `<circle cx="30" cy="-1" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="70" cy="-1" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="30" cy="101" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="70" cy="101" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="-1" cy="30" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="-1" cy="70" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="101" cy="30" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="101" cy="70" r="2" fill="#E8EAF8" opacity="0.85"/>` +
        `<circle cx="42" cy="-1.5" r="1.2" fill="#D8DCF0" opacity="0.6"/>` +
        `<circle cx="58" cy="-1.5" r="1.2" fill="#D8DCF0" opacity="0.6"/>` +
        `<circle cx="42" cy="101.5" r="1.2" fill="#D8DCF0" opacity="0.6"/>` +
        `<circle cx="58" cy="101.5" r="1.2" fill="#D8DCF0" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
MoonSilverFrame.displayName = 'MoonSilverFrame';

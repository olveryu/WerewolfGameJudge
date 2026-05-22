/** VenomGlassFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const VenomGlassFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#27AE60" stop-opacity="0.85"/>` +
        `<stop offset="0.5" stop-color="#1E8449" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#27AE60" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="-1" y="-1" width="102" height="102" rx="${rxVal + 1}" fill="none" stroke="#82E0AA" stroke-width="1.2" opacity="0.25"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<path d="M3,3 L15,15" stroke="#A9DFBF" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M3,5 L10,18" stroke="#A9DFBF" stroke-width="0.5" opacity="0.4"/>` +
        `<path d="M97,3 L85,15" stroke="#A9DFBF" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M97,97 L85,85" stroke="#A9DFBF" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M3,97 L15,85" stroke="#A9DFBF" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M20,-1 Q20,-4 18,-6 Q20,-8 22,-6 Q20,-4 20,-1 Z" fill="#27AE60" opacity="0.8"/>` +
        `<path d="M45,-1 Q45,-3 43,-5 Q45,-7 47,-5 Q45,-3 45,-1 Z" fill="#1E8449" opacity="0.75"/>` +
        `<path d="M70,-1 Q70,-4 68,-7 Q70,-9 72,-7 Q70,-4 70,-1 Z" fill="#27AE60" opacity="0.8"/>` +
        `<path d="M30,101 Q30,104 28,106 Q30,108 32,106 Q30,104 30,101 Z" fill="#27AE60" opacity="0.8"/>` +
        `<path d="M55,101 Q55,103 53,105 Q55,107 57,105 Q55,103 55,101 Z" fill="#1E8449" opacity="0.75"/>` +
        `<path d="M80,101 Q80,104 78,107 Q80,109 82,107 Q80,104 80,101 Z" fill="#27AE60" opacity="0.8"/>` +
        `<path d="M-1,30 Q-4,30 -6,28 Q-8,30 -6,32 Q-4,30 -1,30 Z" fill="#27AE60" opacity="0.75"/>` +
        `<path d="M-1,65 Q-3,65 -5,63 Q-7,65 -5,67 Q-3,65 -1,65 Z" fill="#1E8449" opacity="0.7"/>` +
        `<path d="M101,40 Q104,40 106,38 Q108,40 106,42 Q104,40 101,40 Z" fill="#27AE60" opacity="0.75"/>` +
        `<path d="M101,75 Q103,75 105,73 Q107,75 105,77 Q103,75 101,75 Z" fill="#1E8449" opacity="0.7"/>` +
        `<circle cx="0" cy="0" r="3.5" fill="#1E8449" stroke="#27AE60" stroke-width="0.8" opacity="0.75"/>` +
        `<path d="M-2,-3 Q0,-6 2,-3" fill="#27AE60" opacity="0.6"/>` +
        `<circle cx="100" cy="0" r="3.5" fill="#1E8449" stroke="#27AE60" stroke-width="0.8" opacity="0.75"/>` +
        `<path d="M98,-3 Q100,-6 102,-3" fill="#27AE60" opacity="0.6"/>` +
        `<circle cx="0" cy="100" r="3.5" fill="#1E8449" stroke="#27AE60" stroke-width="0.8" opacity="0.75"/>` +
        `<circle cx="100" cy="100" r="3.5" fill="#1E8449" stroke="#27AE60" stroke-width="0.8" opacity="0.75"/>` +
        `<circle cx="50" cy="-4" r="1.5" fill="#82E0AA" opacity="0.7"/>` +
        `<circle cx="-4" cy="50" r="1.5" fill="#82E0AA" opacity="0.7"/>` +
        `<circle cx="104" cy="50" r="1.5" fill="#82E0AA" opacity="0.7"/>` +
        `<circle cx="50" cy="104" r="1.5" fill="#82E0AA" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
VenomGlassFrame.displayName = 'VenomGlassFrame';

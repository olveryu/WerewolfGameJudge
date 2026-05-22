/** WolfFangFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const WolfFangFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#7B5B3A" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#5B3A1A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#7B5B3A" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A0E05" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#8B6B4A" stroke-width="0.7" opacity="0.4" stroke-dasharray="3,3"/>` +
        `<path d="M15,0 L14,-7 Q15,-8 16,-7 L15,0 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M30,0 L29,-6 Q30,-7 31,-6 L30,0 Z" fill="#EDE8D0" stroke="#D5D5B0" stroke-width="0.4" opacity="0.8"/>` +
        `<path d="M50,0 L49,-8 Q50,-9 51,-8 L50,0 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M70,0 L69,-6 Q70,-7 71,-6 L70,0 Z" fill="#EDE8D0" stroke="#D5D5B0" stroke-width="0.4" opacity="0.8"/>` +
        `<path d="M85,0 L84,-7 Q85,-8 86,-7 L85,0 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M15,100 L14,107 Q15,108 16,107 L15,100 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M50,100 L49,108 Q50,109 51,108 L50,100 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M85,100 L84,107 Q85,108 86,107 L85,100 Z" fill="#F5F5DC" stroke="#D5D5B0" stroke-width="0.4" opacity="0.85"/>` +
        `<path d="M0,20 L-7,19 Q-8,20 -7,21 L0,20 Z" fill="#F5F5DC" opacity="0.8"/>` +
        `<path d="M0,50 L-8,49 Q-9,50 -8,51 L0,50 Z" fill="#F5F5DC" opacity="0.85"/>` +
        `<path d="M0,80 L-7,79 Q-8,80 -7,81 L0,80 Z" fill="#F5F5DC" opacity="0.8"/>` +
        `<path d="M100,25 L107,24 Q108,25 107,26 L100,25 Z" fill="#F5F5DC" opacity="0.8"/>` +
        `<path d="M100,50 L108,49 Q109,50 108,51 L100,50 Z" fill="#F5F5DC" opacity="0.85"/>` +
        `<path d="M100,75 L107,74 Q108,75 107,76 L100,75 Z" fill="#F5F5DC" opacity="0.8"/>` +
        `<circle cx="0" cy="0" r="2.5" fill="#5B3A1A" opacity="0.7"/>` +
        `<circle cx="-2" cy="-4" r="1" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="2" cy="-4" r="1" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="-3" cy="-2" r="0.8" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="3" cy="-2" r="0.8" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="100" cy="100" r="2.5" fill="#5B3A1A" opacity="0.7"/>` +
        `<circle cx="98" cy="104" r="1" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="102" cy="104" r="1" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="97" cy="102" r="0.8" fill="#5B3A1A" opacity="0.6"/>` +
        `<circle cx="103" cy="102" r="0.8" fill="#5B3A1A" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
WolfFangFrame.displayName = 'WolfFangFrame';

/** HellFireFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const HellFireFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="1" x2="0" y2="0">` +
        `<stop offset="0" stop-color="#FF6B20" stop-opacity="0.95"/>` +
        `<stop offset="0.3" stop-color="#CC2200" stop-opacity="0.9"/>` +
        `<stop offset="0.6" stop-color="#4A1800" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#4A1800" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="2.5"/>` +
        `<path d="M15,100 Q12,88 18,82 Q14,90 20,100" fill="#FF6B20" opacity="0.8"/>` +
        `<path d="M30,100 Q26,85 33,78 Q28,87 35,100" fill="#CC2200" opacity="0.85"/>` +
        `<path d="M45,100 Q42,82 50,74 Q46,84 52,100" fill="#FF8830" opacity="0.9"/>` +
        `<path d="M60,100 Q56,80 63,74 Q58,84 65,100" fill="#FF6B20" opacity="0.85"/>` +
        `<path d="M75,100 Q72,86 78,80 Q74,88 80,100" fill="#CC2200" opacity="0.8"/>` +
        `<path d="M88,100 Q85,90 90,84 Q87,92 92,100" fill="#FF6B20" opacity="0.7"/>` +
        `<path d="M0,82 Q-5,76 0,70" fill="none" stroke="#FF6B20" stroke-width="1.5" opacity="0.6"/>` +
        `<path d="M100,82 Q105,76 100,70" fill="none" stroke="#FF6B20" stroke-width="1.5" opacity="0.6"/>` +
        `<circle cx="20" cy="92" r="1" fill="#FFB020" opacity="0.7"/>` +
        `<circle cx="40" cy="86" r="0.8" fill="#FFCC40" opacity="0.6"/>` +
        `<circle cx="65" cy="88" r="1" fill="#FFB020" opacity="0.7"/>` +
        `<circle cx="85" cy="94" r="0.7" fill="#FFCC40" opacity="0.5"/>` +
        `<circle cx="50" cy="80" r="0.8" fill="#FF8830" opacity="0.6"/>` +
        `<line x1="20" y1="0" x2="80" y2="0" stroke="#CC2200" stroke-width="1" opacity="0.4"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
HellFireFrame.displayName = 'HellFireFrame';

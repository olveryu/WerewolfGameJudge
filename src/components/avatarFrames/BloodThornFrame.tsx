/** BloodThornFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const BloodThornFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#CC3333" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#6B1010" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<path d="M20,0 L23,-6 L26,0" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M38,0 L41,-5 L44,0" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M56,0 L59,-5 L62,0" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M74,0 L77,-6 L80,0" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M20,100 L23,106 L26,100" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M38,100 L41,105 L44,100" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M56,100 L59,105 L62,100" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M74,100 L77,106 L80,100" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M0,20 L-6,23 L0,26" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M0,38 L-5,41 L0,44" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M0,56 L-5,59 L0,62" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M0,74 L-6,77 L0,80" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M100,20 L106,23 L100,26" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M100,38 L105,41 L100,44" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M100,56 L105,59 L100,62" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M100,74 L106,77 L100,80" fill="#8B1A1A" stroke="#CC3333" stroke-width="0.8"/>` +
        `<path d="M${c},${c} L${c - 6},${c - 6} L${c},${c - 2} Z" fill="#CC3333" opacity="0.8"/>` +
        `<path d="M${100 - c},${c} L${100 - c + 6},${c - 6} L${100 - c},${c - 2} Z" fill="#CC3333" opacity="0.8"/>` +
        `<path d="M${c},${100 - c} L${c - 6},${100 - c + 6} L${c},${100 - c + 2} Z" fill="#CC3333" opacity="0.8"/>` +
        `<path d="M${100 - c},${100 - c} L${100 - c + 6},${100 - c + 6} L${100 - c},${100 - c + 2} Z" fill="#CC3333" opacity="0.8"/>` +
        `<path d="M50,0 Q50,-3 50,-5" fill="none" stroke="#FF4444" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M50,100 Q50,103 50,105" fill="none" stroke="#FF4444" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
BloodThornFrame.displayName = 'BloodThornFrame';

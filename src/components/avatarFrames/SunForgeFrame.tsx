/** SunForgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SunForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#F1C40F" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#D4AC0D" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#F1C40F" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="-1" y="-1" width="102" height="102" rx="${rxVal + 1}" fill="none" stroke="#F9E79F" stroke-width="1.5" opacity="0.3"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#F9E79F" stroke-width="0.7" opacity="0.5"/>` +
        `<path d="M0,0 L-4,-7 L2,-3 L-1,-8 L4,-4 Z" fill="#D4AC0D" stroke="#F1C40F" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M100,0 L104,-7 L98,-3 L101,-8 L96,-4 Z" fill="#D4AC0D" stroke="#F1C40F" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M0,100 L-4,107 L2,103 L-1,108 L4,104 Z" fill="#D4AC0D" stroke="#F1C40F" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M100,100 L104,107 L98,103 L101,108 L96,104 Z" fill="#D4AC0D" stroke="#F1C40F" stroke-width="0.5" opacity="0.85"/>` +
        `<path d="M20,0 L22,-5 L24,0" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M35,0 L37,-4 L39,0" fill="#F1C40F" opacity="0.7"/>` +
        `<path d="M48,0 L50,-6 L52,0" fill="#D4AC0D" opacity="0.8"/>` +
        `<path d="M61,0 L63,-4 L65,0" fill="#F1C40F" opacity="0.7"/>` +
        `<path d="M76,0 L78,-5 L80,0" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M20,100 L22,105 L24,100" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M48,100 L50,106 L52,100" fill="#D4AC0D" opacity="0.8"/>` +
        `<path d="M76,100 L78,105 L80,100" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M0,25 L-4,27 L0,29" fill="#D4AC0D" opacity="0.7"/>` +
        `<path d="M0,48 L-5,50 L0,52" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M0,73 L-4,75 L0,77" fill="#D4AC0D" opacity="0.7"/>` +
        `<path d="M100,25 L104,27 L100,29" fill="#D4AC0D" opacity="0.7"/>` +
        `<path d="M100,48 L105,50 L100,52" fill="#D4AC0D" opacity="0.75"/>` +
        `<path d="M100,73 L104,75 L100,77" fill="#D4AC0D" opacity="0.7"/>` +
        `<circle cx="50" cy="-1" r="3" fill="#B7950B" stroke="#F1C40F" stroke-width="0.7" opacity="0.7"/>` +
        `<circle cx="50" cy="-1" r="1.5" fill="#F9E79F" opacity="0.8"/>` +
        `<circle cx="50" cy="101" r="3" fill="#B7950B" stroke="#F1C40F" stroke-width="0.7" opacity="0.7"/>` +
        `<circle cx="50" cy="101" r="1.5" fill="#F9E79F" opacity="0.8"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SunForgeFrame.displayName = 'SunForgeFrame';

/** CrystalThornFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const CrystalThornFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#9B59B6" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#6C3483" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#9B59B6" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#D2B4DE" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M15,0 L17,-7 L19,0" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M30,0 L33,-6 L36,0" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M48,0 L50,-8 L52,0" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M64,0 L67,-6 L70,0" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M81,0 L83,-7 L85,0" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M15,100 L17,107 L19,100" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M30,100 L33,106 L36,100" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M48,100 L50,108 L52,100" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M64,100 L67,106 L70,100" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M81,100 L83,107 L85,100" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M0,15 L-7,17 L0,19" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M0,35 L-6,38 L0,41" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M0,55 L-7,58 L0,61" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M0,78 L-6,81 L0,84" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M100,15 L107,17 L100,19" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M100,35 L106,38 L100,41" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M100,55 L107,58 L100,61" fill="#8E44AD" stroke="#D2B4DE" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M100,78 L106,81 L100,84" fill="#7D3C98" stroke="#D2B4DE" stroke-width="0.6" opacity="0.75"/>` +
        `<path d="M3,3 L-5,-5 L3,0 Z" fill="#9B59B6" opacity="0.85"/>` +
        `<path d="M1,5 L-6,-1 L2,2 Z" fill="#7D3C98" opacity="0.7"/>` +
        `<path d="M97,3 L105,-5 L97,0 Z" fill="#9B59B6" opacity="0.85"/>` +
        `<path d="M99,5 L106,-1 L98,2 Z" fill="#7D3C98" opacity="0.7"/>` +
        `<path d="M3,97 L-5,105 L3,100 Z" fill="#9B59B6" opacity="0.85"/>` +
        `<path d="M1,95 L-6,101 L2,98 Z" fill="#7D3C98" opacity="0.7"/>` +
        `<path d="M97,97 L105,105 L97,100 Z" fill="#9B59B6" opacity="0.85"/>` +
        `<path d="M99,95 L106,101 L98,98 Z" fill="#7D3C98" opacity="0.7"/>` +
        `<circle cx="50" cy="-4" r="1.2" fill="#E8DAEF" opacity="0.8"/>` +
        `<circle cx="50" cy="104" r="1.2" fill="#E8DAEF" opacity="0.8"/>` +
        `<circle cx="-4" cy="50" r="1.2" fill="#E8DAEF" opacity="0.8"/>` +
        `<circle cx="104" cy="50" r="1.2" fill="#E8DAEF" opacity="0.8"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
CrystalThornFrame.displayName = 'CrystalThornFrame';

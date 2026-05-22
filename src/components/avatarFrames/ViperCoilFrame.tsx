/** ViperCoilFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const ViperCoilFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#2ECC71" stop-opacity="0.85"/>` +
        `<stop offset="0.5" stop-color="#1D8348" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2ECC71" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#58D68D" stroke-width="0.6" opacity="0.4"/>` +
        `<path d="M-3,10 Q-6,5 -3,0 Q0,-5 5,-3" fill="none" stroke="#1D8348" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M5,-3 L8,-7 L10,-2 Z" fill="#1D8348" stroke="#2ECC71" stroke-width="0.5" opacity="0.85"/>` +
        `<circle cx="7" cy="-5" r="0.8" fill="#E74C3C" opacity="0.9"/>` +
        `<path d="M103,10 Q106,5 103,0 Q100,-5 95,-3" fill="none" stroke="#1D8348" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M95,-3 L92,-7 L90,-2 Z" fill="#1D8348" stroke="#2ECC71" stroke-width="0.5" opacity="0.85"/>` +
        `<circle cx="93" cy="-5" r="0.8" fill="#E74C3C" opacity="0.9"/>` +
        `<path d="M-3,90 Q-6,95 -3,100 Q0,105 5,103" fill="none" stroke="#1D8348" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M5,103 L8,107 L10,102 Z" fill="#1D8348" stroke="#2ECC71" stroke-width="0.5" opacity="0.85"/>` +
        `<circle cx="7" cy="105" r="0.8" fill="#E74C3C" opacity="0.9"/>` +
        `<path d="M103,90 Q106,95 103,100 Q100,105 95,103" fill="none" stroke="#1D8348" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M95,103 L92,107 L90,102 Z" fill="#1D8348" stroke="#2ECC71" stroke-width="0.5" opacity="0.85"/>` +
        `<circle cx="93" cy="105" r="0.8" fill="#E74C3C" opacity="0.9"/>` +
        `<path d="M20,0 Q25,-2 30,0" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M35,0 Q40,-2 45,0" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M50,0 Q55,-2 60,0" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M65,0 Q70,-2 75,0" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M25,100 Q30,102 35,100" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M45,100 Q50,102 55,100" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M65,100 Q70,102 75,100" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.55"/>` +
        `<path d="M0,25 Q-2,30 0,35" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.5"/>` +
        `<path d="M0,55 Q-2,60 0,65" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.5"/>` +
        `<path d="M100,35 Q102,40 100,45" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.5"/>` +
        `<path d="M100,65 Q102,70 100,75" fill="none" stroke="#2ECC71" stroke-width="1" opacity="0.5"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
ViperCoilFrame.displayName = 'ViperCoilFrame';

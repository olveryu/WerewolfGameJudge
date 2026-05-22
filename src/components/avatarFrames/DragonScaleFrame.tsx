/** DragonScaleFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const DragonScaleFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#2A6B3A" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#1A4A28" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#0D3018" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#D4AA30" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="#8A6E18" stop-opacity="0.8"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#081808" stroke-width="5.5" opacity="0.25"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 5, 0)}" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.5"/>` +
        `<g opacity="0.55" fill="none" stroke="#C9A84C" stroke-width="1">` +
        `<path d="M18,0 Q21,-4 24,0"/>` +
        `<path d="M24,0 Q27,-4 30,0"/>` +
        `<path d="M30,0 Q33,-4 36,0"/>` +
        `<path d="M36,0 Q39,-4 42,0"/>` +
        `<path d="M42,0 Q45,-4 48,0"/>` +
        `<path d="M52,0 Q55,-4 58,0"/>` +
        `<path d="M58,0 Q61,-4 64,0"/>` +
        `<path d="M64,0 Q67,-4 70,0"/>` +
        `<path d="M70,0 Q73,-4 76,0"/>` +
        `<path d="M76,0 Q79,-4 82,0"/>` +
        `</g>` +
        `<g opacity="0.55" fill="none" stroke="#C9A84C" stroke-width="1">` +
        `<path d="M18,100 Q21,104 24,100"/>` +
        `<path d="M24,100 Q27,104 30,100"/>` +
        `<path d="M30,100 Q33,104 36,100"/>` +
        `<path d="M36,100 Q39,104 42,100"/>` +
        `<path d="M42,100 Q45,104 48,100"/>` +
        `<path d="M52,100 Q55,104 58,100"/>` +
        `<path d="M58,100 Q61,104 64,100"/>` +
        `<path d="M64,100 Q67,104 70,100"/>` +
        `<path d="M70,100 Q73,104 76,100"/>` +
        `<path d="M76,100 Q79,104 82,100"/>` +
        `</g>` +
        `<g opacity="0.55" fill="none" stroke="#C9A84C" stroke-width="1">` +
        `<path d="M0,18 Q-4,21 0,24"/>` +
        `<path d="M0,24 Q-4,27 0,30"/>` +
        `<path d="M0,30 Q-4,33 0,36"/>` +
        `<path d="M0,36 Q-4,39 0,42"/>` +
        `<path d="M0,58 Q-4,61 0,64"/>` +
        `<path d="M0,64 Q-4,67 0,70"/>` +
        `<path d="M0,70 Q-4,73 0,76"/>` +
        `<path d="M0,76 Q-4,79 0,82"/>` +
        `</g>` +
        `<g opacity="0.55" fill="none" stroke="#C9A84C" stroke-width="1">` +
        `<path d="M100,18 Q104,21 100,24"/>` +
        `<path d="M100,24 Q104,27 100,30"/>` +
        `<path d="M100,30 Q104,33 100,36"/>` +
        `<path d="M100,36 Q104,39 100,42"/>` +
        `<path d="M100,58 Q104,61 100,64"/>` +
        `<path d="M100,64 Q104,67 100,70"/>` +
        `<path d="M100,70 Q104,73 100,76"/>` +
        `<path d="M100,76 Q104,79 100,82"/>` +
        `</g>` +
        `<path d="M6,2 Q0,-6 -5,-4 Q-2,-2 2,1" fill="#1A4A28" stroke="#C9A84C" stroke-width="0.8" opacity="0.8"/>` +
        `<path d="M3,0 Q-3,-10 -6,-8 Q-1,-5 2,-1" fill="#2A6B3A" stroke="#8A6E18" stroke-width="0.6" opacity="0.6"/>` +
        `<path d="M94,2 Q100,-6 105,-4 Q102,-2 98,1" fill="#1A4A28" stroke="#C9A84C" stroke-width="0.8" opacity="0.8"/>` +
        `<path d="M97,0 Q103,-10 106,-8 Q101,-5 98,-1" fill="#2A6B3A" stroke="#8A6E18" stroke-width="0.6" opacity="0.6"/>` +
        `<circle cx="5" cy="5" r="3.5" fill="none" stroke="#C9A84C" stroke-width="0.6" opacity="0.4"/>` +
        `<circle cx="5" cy="5" r="2.2" fill="#C9A84C" opacity="0.85"/>` +
        `<circle cx="5" cy="5" r="1" fill="#FFE066" opacity="0.95"/>` +
        `<circle cx="4.5" cy="4.5" r="0.4" fill="#fff" opacity="0.8"/>` +
        `<circle cx="95" cy="5" r="3.5" fill="none" stroke="#C9A84C" stroke-width="0.6" opacity="0.4"/>` +
        `<circle cx="95" cy="5" r="2.2" fill="#C9A84C" opacity="0.85"/>` +
        `<circle cx="95" cy="5" r="1" fill="#FFE066" opacity="0.95"/>` +
        `<circle cx="94.5" cy="4.5" r="0.4" fill="#fff" opacity="0.8"/>` +
        `<path d="M3,100 Q-2,104 -4,102 Q0,101 3,100" fill="#1A4A28" stroke="#8A6E18" stroke-width="0.5" opacity="0.6"/>` +
        `<path d="M97,100 Q102,104 104,102 Q100,101 97,100" fill="#1A4A28" stroke="#8A6E18" stroke-width="0.5" opacity="0.6"/>` +
        `<path d="M48,0 L50,-4 L52,0" fill="none" stroke="url(#b)" stroke-width="1.2" opacity="0.7"/>` +
        `<path d="M48,100 L50,104 L52,100" fill="none" stroke="url(#b)" stroke-width="1.2" opacity="0.7"/>` +
        `<path d="M0,48 L-4,50 L0,52" fill="none" stroke="url(#b)" stroke-width="1.2" opacity="0.7"/>` +
        `<path d="M100,48 L104,50 L100,52" fill="none" stroke="url(#b)" stroke-width="1.2" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
DragonScaleFrame.displayName = 'DragonScaleFrame';

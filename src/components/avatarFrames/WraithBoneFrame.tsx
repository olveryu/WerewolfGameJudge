/** WraithBoneFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const WraithBoneFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#D5D5D0" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#A0A098" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#D5D5D0" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A1A18" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#E0E0D8" stroke-width="0.6" opacity="0.4"/>` +
        `<circle cx="0" cy="0" r="5" fill="#C8C8C0" stroke="#A0A098" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="-1.5" cy="-1" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<circle cx="1.5" cy="-1" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<path d="M-1,1.5 L0,2.5 L1,1.5" fill="none" stroke="#2C2C28" stroke-width="0.5" opacity="0.6"/>` +
        `<circle cx="100" cy="0" r="5" fill="#C8C8C0" stroke="#A0A098" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="98.5" cy="-1" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<circle cx="101.5" cy="-1" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<path d="M99,1.5 L100,2.5 L101,1.5" fill="none" stroke="#2C2C28" stroke-width="0.5" opacity="0.6"/>` +
        `<circle cx="0" cy="100" r="5" fill="#C8C8C0" stroke="#A0A098" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="-1.5" cy="99" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<circle cx="1.5" cy="99" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<circle cx="100" cy="100" r="5" fill="#C8C8C0" stroke="#A0A098" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="98.5" cy="99" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<circle cx="101.5" cy="99" r="1.2" fill="#2C2C28" opacity="0.7"/>` +
        `<path d="M20,-1 Q22,-4 24,-1 Q22,-2 20,-1 Z" fill="#D5D5D0" stroke="#B8B8B0" stroke-width="0.4" opacity="0.75"/>` +
        `<path d="M38,-1 Q40,-3 42,-1 Q40,-2 38,-1 Z" fill="#C8C8C0" opacity="0.7"/>` +
        `<path d="M58,-1 Q60,-4 62,-1 Q60,-2 58,-1 Z" fill="#D5D5D0" stroke="#B8B8B0" stroke-width="0.4" opacity="0.75"/>` +
        `<path d="M78,-1 Q80,-3 82,-1 Q80,-2 78,-1 Z" fill="#C8C8C0" opacity="0.7"/>` +
        `<path d="M25,101 Q27,104 29,101 Q27,102 25,101 Z" fill="#D5D5D0" opacity="0.75"/>` +
        `<path d="M48,101 Q50,104 52,101 Q50,102 48,101 Z" fill="#D5D5D0" opacity="0.75"/>` +
        `<path d="M72,101 Q74,103 76,101 Q74,102 72,101 Z" fill="#C8C8C0" opacity="0.7"/>` +
        `<path d="M-1,30 Q-3,32 -1,34" fill="none" stroke="#C8C8C0" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-1,60 Q-3,62 -1,64" fill="none" stroke="#C8C8C0" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M101,40 Q103,42 101,44" fill="none" stroke="#C8C8C0" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M101,70 Q103,72 101,74" fill="none" stroke="#C8C8C0" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<circle cx="50" cy="-4" r="1.5" fill="#58D68D" opacity="0.6"/>` +
        `<circle cx="-4" cy="50" r="1.2" fill="#58D68D" opacity="0.5"/>` +
        `<circle cx="104" cy="50" r="1.2" fill="#58D68D" opacity="0.5"/>` +
        `<circle cx="50" cy="104" r="1.5" fill="#58D68D" opacity="0.6"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
WraithBoneFrame.displayName = 'WraithBoneFrame';

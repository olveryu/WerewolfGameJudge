/** SandStoneFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SandStoneFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#D4B88C" stop-opacity="0.9"/>` +
        `<stop offset="0.4" stop-color="#B89860" stop-opacity="1"/>` +
        `<stop offset="0.6" stop-color="#A08040" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#D4B88C" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#302010" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<path d="M-2,-2 L-6,-6 L3,-5 L-4,3 Z" fill="#C0A060" stroke="#D4B88C" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M102,-2 L106,-6 L97,-5 L104,3 Z" fill="#C0A060" stroke="#D4B88C" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M-2,102 L-6,106 L3,105 L-4,97 Z" fill="#C0A060" stroke="#D4B88C" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M102,102 L106,106 L97,105 L104,97 Z" fill="#C0A060" stroke="#D4B88C" stroke-width="0.6" opacity="0.8"/>` +
        `<path d="M-4,-4 L5,8" fill="none" stroke="#806830" stroke-width="1" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M104,-4 L95,8" fill="none" stroke="#806830" stroke-width="1" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M-4,104 L5,92" fill="none" stroke="#806830" stroke-width="1" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M104,104 L95,92" fill="none" stroke="#806830" stroke-width="1" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M20,-2 Q22,-5 24,-2 L22,0 Z" fill="#A08040" opacity="0.7"/>` +
        `<path d="M38,-2 L40,-5 L42,-2 L40,-1 Z" fill="#B89860" opacity="0.65"/>` +
        `<path d="M58,-2 Q60,-6 62,-2 L60,0 Z" fill="#A08040" opacity="0.7"/>` +
        `<path d="M76,-2 L78,-5 L80,-2 L78,-1 Z" fill="#B89860" opacity="0.65"/>` +
        `<path d="M25,102 Q27,105 29,102 L27,100 Z" fill="#A08040" opacity="0.7"/>` +
        `<path d="M50,102 L52,106 L54,102 L52,100 Z" fill="#B89860" opacity="0.65"/>` +
        `<path d="M72,102 Q74,105 76,102 L74,100 Z" fill="#A08040" opacity="0.7"/>` +
        `<path d="M-2,25 Q-5,28 -2,31" fill="none" stroke="#C0A060" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-2,60 Q-5,63 -2,66" fill="none" stroke="#C0A060" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,35 Q105,38 102,41" fill="none" stroke="#C0A060" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,70 Q105,73 102,76" fill="none" stroke="#C0A060" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<circle cx="50" cy="-4" r="1.2" fill="#D4B88C" opacity="0.7"/>` +
        `<circle cx="-4" cy="50" r="1.2" fill="#D4B88C" opacity="0.7"/>` +
        `<circle cx="104" cy="50" r="1.2" fill="#D4B88C" opacity="0.7"/>` +
        `<circle cx="50" cy="104" r="1.2" fill="#D4B88C" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SandStoneFrame.displayName = 'SandStoneFrame';

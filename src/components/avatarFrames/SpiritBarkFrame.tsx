/** SpiritBarkFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const SpiritBarkFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#6B4226" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#4A2C17" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#6B4226" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#1A0E08" stroke-width="6" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#8B5E3C" stroke-width="0.7" opacity="0.4"/>` +
        `<path d="M-2,-2 Q-8,5 -6,15 Q-4,10 -1,6" fill="none" stroke="#5C3A1E" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M0,-3 Q-5,3 -4,10" fill="none" stroke="#7B4F2E" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,-2 Q108,5 106,15 Q104,10 101,6" fill="none" stroke="#5C3A1E" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M100,-3 Q105,3 104,10" fill="none" stroke="#7B4F2E" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M-2,102 Q-8,95 -6,85 Q-4,90 -1,94" fill="none" stroke="#5C3A1E" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<path d="M0,103 Q-5,97 -4,90" fill="none" stroke="#7B4F2E" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M102,102 Q108,95 106,85 Q104,90 101,94" fill="none" stroke="#5C3A1E" stroke-width="3" opacity="0.8" stroke-linecap="round"/>` +
        `<circle cx="30" cy="-1" r="2.5" fill="#5C3A1E" stroke="#7B4F2E" stroke-width="0.6" opacity="0.7"/>` +
        `<circle cx="70" cy="-1" r="2" fill="#4A2C17" stroke="#7B4F2E" stroke-width="0.6" opacity="0.65"/>` +
        `<circle cx="-1" cy="40" r="2.2" fill="#5C3A1E" stroke="#7B4F2E" stroke-width="0.6" opacity="0.7"/>` +
        `<circle cx="101" cy="60" r="2.5" fill="#5C3A1E" stroke="#7B4F2E" stroke-width="0.6" opacity="0.7"/>` +
        `<circle cx="40" cy="101" r="2" fill="#4A2C17" stroke="#7B4F2E" stroke-width="0.6" opacity="0.65"/>` +
        `<circle cx="75" cy="101" r="2.3" fill="#5C3A1E" stroke="#7B4F2E" stroke-width="0.6" opacity="0.7"/>` +
        `<circle cx="15" cy="-3" r="1.2" fill="#58D68D" opacity="0.6"/>` +
        `<circle cx="-3" cy="25" r="1" fill="#58D68D" opacity="0.5"/>` +
        `<circle cx="85" cy="103" r="1.2" fill="#58D68D" opacity="0.6"/>` +
        `<circle cx="103" cy="75" r="1" fill="#58D68D" opacity="0.5"/>` +
        `<path d="M10,0 L12,3" stroke="#3A1F0F" stroke-width="0.8" opacity="0.4" stroke-linecap="round"/>` +
        `<path d="M50,0 L52,3" stroke="#3A1F0F" stroke-width="0.8" opacity="0.4" stroke-linecap="round"/>` +
        `<path d="M0,55 L3,57" stroke="#3A1F0F" stroke-width="0.8" opacity="0.4" stroke-linecap="round"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
SpiritBarkFrame.displayName = 'SpiritBarkFrame';

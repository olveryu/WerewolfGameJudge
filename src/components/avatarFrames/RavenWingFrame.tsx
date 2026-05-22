/** RavenWingFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const RavenWingFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#2C2C34" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#121216" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2C2C34" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#000005" stroke-width="6" opacity="0.2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<path d="M-1,-1 L-7,-5 L-4,3 Z" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M2,-1 L-3,-8 L0,2 Z" fill="#222228" stroke="#3A3A44" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M5,-1 L1,-7 L4,1 Z" fill="#1A1A20" opacity="0.65"/>` +
        `<path d="M101,-1 L107,-5 L104,3 Z" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M98,-1 L103,-8 L100,2 Z" fill="#222228" stroke="#3A3A44" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M95,-1 L99,-7 L96,1 Z" fill="#1A1A20" opacity="0.65"/>` +
        `<path d="M-1,101 L-7,105 L-4,97 Z" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M2,101 L-3,108 L0,98 Z" fill="#222228" stroke="#3A3A44" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M101,101 L107,105 L104,97 Z" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.6" opacity="0.85"/>` +
        `<path d="M98,101 L103,108 L100,98 Z" fill="#222228" stroke="#3A3A44" stroke-width="0.5" opacity="0.75"/>` +
        `<path d="M15,-1 Q20,-5 25,-1" fill="#1A1A20" stroke="#2A2A30" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M30,-1 Q35,-4 40,-1" fill="#222228" stroke="#2A2A30" stroke-width="0.6" opacity="0.65"/>` +
        `<path d="M45,-1 Q50,-5 55,-1" fill="#1A1A20" stroke="#2A2A30" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M60,-1 Q65,-4 70,-1" fill="#222228" stroke="#2A2A30" stroke-width="0.6" opacity="0.65"/>` +
        `<path d="M75,-1 Q80,-5 85,-1" fill="#1A1A20" stroke="#2A2A30" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M15,101 Q20,105 25,101" fill="#1A1A20" stroke="#2A2A30" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M35,101 Q40,104 45,101" fill="#222228" stroke="#2A2A30" stroke-width="0.6" opacity="0.65"/>` +
        `<path d="M55,101 Q60,105 65,101" fill="#1A1A20" stroke="#2A2A30" stroke-width="0.6" opacity="0.7"/>` +
        `<path d="M75,101 Q80,104 85,101" fill="#222228" stroke="#2A2A30" stroke-width="0.6" opacity="0.65"/>` +
        `<circle cx="-2" cy="50" r="2.5" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="-2" cy="50" r="1.2" fill="#CC2222" opacity="0.9"/>` +
        `<circle cx="-1.5" cy="49.5" r="0.4" fill="#FF4444" opacity="0.8"/>` +
        `<circle cx="102" cy="50" r="2.5" fill="#1A1A20" stroke="#3A3A44" stroke-width="0.8" opacity="0.8"/>` +
        `<circle cx="102" cy="50" r="1.2" fill="#CC2222" opacity="0.9"/>` +
        `<circle cx="102.5" cy="49.5" r="0.4" fill="#FF4444" opacity="0.8"/>` +
        `<path d="M20,0 Q50,-2 80,0" fill="none" stroke="#4A4A5A" stroke-width="0.6" opacity="0.4"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
RavenWingFrame.displayName = 'RavenWingFrame';

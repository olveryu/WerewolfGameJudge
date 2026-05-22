/** EmberAshFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const EmberAshFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#4A4A4A" stop-opacity="0.95"/>` +
        `<stop offset="0.4" stop-color="#2A2A2A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#3A3A3A" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="1" x2="0" y2="0">` +
        `<stop offset="0" stop-color="#FF4500" stop-opacity="0.4"/>` +
        `<stop offset="1" stop-color="#FF4500" stop-opacity="0"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="-4" y="40" width="108" height="68" rx="12" fill="url(#b)" opacity="0.3"/>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#000" stroke-width="5" opacity="0.3"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#555" stroke-width="0.7" opacity="0.4" stroke-dasharray="5 3"/>` +
        `<path d="M22,0 L25,2.5 L28,0.5 L32,0" fill="none" stroke="#FF6B20" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M55,0 L57,1.5 L60,-0.5 L63,0" fill="none" stroke="#FF4500" stroke-width="0.9" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M20,100 L23,98 L26,100.5 L30,100" fill="none" stroke="#FF6B20" stroke-width="1.3" opacity="0.65" stroke-linecap="round"/>` +
        `<path d="M40,100 L43,97 L47,99 L50,100" fill="none" stroke="#FF8C00" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M60,100 L63,97.5 L66,99.5 L70,100" fill="none" stroke="#FF6B20" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M78,100 L80,98 L83,100" fill="none" stroke="#FF4500" stroke-width="0.9" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M0,35 L2,38 L0.5,42 L0,45" fill="none" stroke="#FF6B20" stroke-width="1" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M0,65 L1.5,68 L0,70" fill="none" stroke="#FF4500" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>` +
        `<path d="M100,50 L98,53 L100,57" fill="none" stroke="#FF6B20" stroke-width="1" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M100,75 L98.5,78 L100,80" fill="none" stroke="#FF4500" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>` +
        `<circle cx="25" cy="95" r="1.3" fill="#FF4500" opacity="0.65"/>` +
        `<circle cx="35" cy="90" r="0.9" fill="#FF6B20" opacity="0.55"/>` +
        `<circle cx="50" cy="88" r="1.1" fill="#FF8C00" opacity="0.5"/>` +
        `<circle cx="65" cy="92" r="1.2" fill="#FF4500" opacity="0.6"/>` +
        `<circle cx="80" cy="96" r="0.8" fill="#FFAA00" opacity="0.5"/>` +
        `<circle cx="12" cy="-5" r="1.1" fill="#FF4500" opacity="0.55"/>` +
        `<circle cx="40" cy="-6" r="0.7" fill="#FF6B20" opacity="0.4"/>` +
        `<circle cx="80" cy="-4" r="0.9" fill="#FF8C00" opacity="0.45"/>` +
        `<circle cx="-5" cy="25" r="0.8" fill="#FF4500" opacity="0.45"/>` +
        `<circle cx="-4" cy="80" r="1" fill="#FF6B20" opacity="0.5"/>` +
        `<circle cx="105" cy="45" r="0.7" fill="#FF8C00" opacity="0.4"/>` +
        `<circle cx="106" cy="90" r="1" fill="#FF4500" opacity="0.5"/>` +
        `<path d="M20,100 Q22,94 20,88" fill="none" stroke="#FF4500" stroke-width="0.4" opacity="0.2"/>` +
        `<path d="M40,100 Q42,92 40,84" fill="none" stroke="#FF6B20" stroke-width="0.4" opacity="0.2"/>` +
        `<path d="M60,100 Q58,94 60,88" fill="none" stroke="#FF4500" stroke-width="0.4" opacity="0.2"/>` +
        `<path d="M80,100 Q78,95 80,90" fill="none" stroke="#FF6B20" stroke-width="0.4" opacity="0.2"/>` +
        `<g opacity="0.3">` +
        `<circle cx="5" cy="5" r="3" fill="#1A0A00"/>` +
        `<circle cx="95" cy="5" r="2.5" fill="#1A0A00"/>` +
        `<circle cx="5" cy="95" r="2.5" fill="#1A0A00"/>` +
        `<circle cx="95" cy="95" r="3" fill="#1A0A00"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
EmberAshFrame.displayName = 'EmberAshFrame';

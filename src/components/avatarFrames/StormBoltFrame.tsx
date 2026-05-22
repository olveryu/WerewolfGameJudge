/** StormBoltFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const StormBoltFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#4A90D9" stop-opacity="0.95"/>` +
        `<stop offset="0.4" stop-color="#2C3E6B" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#1A2744" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#FFE066" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#FF8C00" stop-opacity="0.7"/>` +
        `</linearGradient>` +
        `<linearGradient id="c" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#6AA8E8" stop-opacity="0.4"/>` +
        `<stop offset="0.5" stop-color="#4A90D9" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#6AA8E8" stop-opacity="0.4"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A1020" stroke-width="5" opacity="0.3"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="url(#c)" stroke-width="1" stroke-dasharray="3 4"/>` +
        `<path d="M18,0 L20,-2 L22,0 L25,-3 L28,0 L30,-2 L33,0" fill="none" stroke="#FFE066" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M67,0 L70,-2 L72,0 L75,-3 L78,0 L80,-2 L82,0" fill="none" stroke="#FFE066" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M18,100 L20,102 L22,100 L25,103 L28,100 L30,102 L33,100" fill="none" stroke="#FFE066" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M67,100 L70,102 L72,100 L75,103 L78,100 L80,102 L82,100" fill="none" stroke="#FFE066" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M10,-1 L7,-5 L12,-4 L9,-9 L14,-7 L11,-12" fill="none" stroke="url(#b)" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="M14,-1 L16,-6 L13,-5 L15,-10" fill="none" stroke="#FFE066" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M90,-1 L93,-5 L88,-4 L91,-9 L86,-7 L89,-12" fill="none" stroke="url(#b)" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="M86,-1 L84,-6 L87,-5 L85,-10" fill="none" stroke="#FFE066" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M10,101 L7,105 L12,104 L9,109 L14,107 L11,112" fill="none" stroke="url(#b)" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="M90,101 L93,105 L88,104 L91,109 L86,107 L89,112" fill="none" stroke="url(#b)" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="M-1,35 L-5,32 L-4,37 L-9,34 L-7,39" fill="none" stroke="url(#b)" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M-1,65 L-4,62 L-3,67 L-7,65" fill="none" stroke="#FFE066" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M101,35 L105,32 L104,37 L109,34 L107,39" fill="none" stroke="url(#b)" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M101,65 L104,62 L103,67 L107,65" fill="none" stroke="#FFE066" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>` +
        `<circle cx="50" cy="-5" r="1.8" fill="#FFE066" opacity="0.7"/>` +
        `<circle cx="50" cy="105" r="1.8" fill="#FFE066" opacity="0.7"/>` +
        `<circle cx="-5" cy="50" r="1.5" fill="#FFE066" opacity="0.6"/>` +
        `<circle cx="105" cy="50" r="1.5" fill="#FFE066" opacity="0.6"/>` +
        `<circle cx="25" cy="-3" r="0.8" fill="#FFD040" opacity="0.5"/>` +
        `<circle cx="75" cy="-3" r="0.8" fill="#FFD040" opacity="0.5"/>` +
        `<circle cx="25" cy="103" r="0.8" fill="#FFD040" opacity="0.5"/>` +
        `<circle cx="75" cy="103" r="0.8" fill="#FFD040" opacity="0.5"/>` +
        `<path d="M0,${rxVal} Q0,0 ${rxVal},0" fill="none" stroke="#4A90D9" stroke-width="5" opacity="0.15"/>` +
        `<path d="M${100 - rxVal},0 Q100,0 100,${rxVal}" fill="none" stroke="#4A90D9" stroke-width="5" opacity="0.15"/>` +
        `<path d="M0,${100 - rxVal} Q0,100 ${rxVal},100" fill="none" stroke="#4A90D9" stroke-width="5" opacity="0.15"/>` +
        `<path d="M${100 - rxVal},100 Q100,100 100,${100 - rxVal}" fill="none" stroke="#4A90D9" stroke-width="5" opacity="0.15"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
StormBoltFrame.displayName = 'StormBoltFrame';

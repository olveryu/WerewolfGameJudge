/** MysticRuneFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const MysticRuneFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#2E4053" stop-opacity="0.95"/>` +
        `<stop offset="0.5" stop-color="#1B2631" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#2E4053" stop-opacity="0.95"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="4.5"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#5DADE2" stroke-width="0.6" opacity="0.35"/>` +
        `<circle cx="0" cy="0" r="6" fill="#1B2631" stroke="#5DADE2" stroke-width="1.2" opacity="0.8"/>` +
        `<path d="M-2,-2 L2,2 M2,-2 L-2,2 M0,-3 L0,3" stroke="#85C1E9" stroke-width="0.7" opacity="0.7"/>` +
        `<circle cx="100" cy="0" r="6" fill="#1B2631" stroke="#5DADE2" stroke-width="1.2" opacity="0.8"/>` +
        `<path d="M98,-2 L102,2 M102,-2 L98,2 M100,-3 L100,3" stroke="#85C1E9" stroke-width="0.7" opacity="0.7"/>` +
        `<circle cx="0" cy="100" r="6" fill="#1B2631" stroke="#5DADE2" stroke-width="1.2" opacity="0.8"/>` +
        `<path d="M-2,98 L2,102 M2,98 L-2,102 M0,97 L0,103" stroke="#85C1E9" stroke-width="0.7" opacity="0.7"/>` +
        `<circle cx="100" cy="100" r="6" fill="#1B2631" stroke="#5DADE2" stroke-width="1.2" opacity="0.8"/>` +
        `<path d="M98,98 L102,102 M102,98 L98,102 M100,97 L100,103" stroke="#85C1E9" stroke-width="0.7" opacity="0.7"/>` +
        `<path d="M20,-1 L22,-4 L24,-1 L26,-3 L28,-1" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M40,-1 L42,-3 L44,-1 L46,-4 L48,-1" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M55,-1 L57,-4 L59,-1 L61,-3 L63,-1" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M72,-1 L74,-3 L76,-1 L78,-4 L80,-1" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M20,101 L22,104 L24,101 L26,103 L28,101" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M55,101 L57,104 L59,101 L61,103 L63,101" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M-1,30 L-4,32 L-1,34" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M-1,60 L-4,62 L-1,64" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M101,40 L104,42 L101,44" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M101,70 L104,72 L101,74" fill="none" stroke="#5DADE2" stroke-width="0.8" opacity="0.5"/>` +
        `<circle cx="50" cy="-2" r="1.5" fill="#85C1E9" opacity="0.7"/>` +
        `<circle cx="50" cy="102" r="1.5" fill="#85C1E9" opacity="0.7"/>` +
        `<circle cx="-2" cy="50" r="1.5" fill="#85C1E9" opacity="0.7"/>` +
        `<circle cx="102" cy="50" r="1.5" fill="#85C1E9" opacity="0.7"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
MysticRuneFrame.displayName = 'MysticRuneFrame';

/** JadeSealFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const JadeSealFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#6BC087" stop-opacity="0.85"/>` +
        `<stop offset="0.35" stop-color="#388E4E" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#2D7A42" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#6BC087" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#A8D8B7" stop-opacity="0"/>` +
        `<stop offset="0.3" stop-color="#C8ECD5" stop-opacity="0.4"/>` +
        `<stop offset="0.5" stop-color="#A8D8B7" stop-opacity="0"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A2010" stroke-width="6.5" opacity="0.15"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#2D7A42" stroke-width="0.8" opacity="0.5"/>` +
        `<path d="M8,0 Q-2,-4 -4,0 Q-2,2 0,0 Q2,-2 8,0" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M0,8 Q-4,-2 0,-4 Q2,-2 0,0 Q-2,2 0,8" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M92,0 Q102,-4 104,0 Q102,2 100,0 Q98,-2 92,0" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M100,8 Q104,-2 100,-4 Q98,-2 100,0 Q102,2 100,8" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M8,100 Q-2,104 -4,100 Q-2,98 0,100 Q2,102 8,100" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M0,92 Q-4,102 0,104 Q2,102 0,100 Q-2,98 0,92" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M92,100 Q102,104 104,100 Q102,98 100,100 Q98,102 92,100" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<path d="M100,92 Q104,102 100,104 Q98,102 100,100 Q102,98 100,92" fill="#4AAE6A" opacity="0.45" stroke="#2D7A42" stroke-width="0.4"/>` +
        `<rect x="36" y="-4" width="28" height="7" rx="1.5" fill="none" stroke="#2D7A42" stroke-width="0.7" opacity="0.5"/>` +
        `<g opacity="0.5" stroke="#1A5A2A" stroke-width="0.5">` +
        `<line x1="40" y1="-2" x2="40" y2="1"/>` +
        `<line x1="44" y1="-2" x2="44" y2="1"/>` +
        `<line x1="48" y1="-2" x2="48" y2="1"/>` +
        `<line x1="52" y1="-2" x2="52" y2="1"/>` +
        `<line x1="56" y1="-2" x2="56" y2="1"/>` +
        `<line x1="60" y1="-2" x2="60" y2="1"/>` +
        `</g>` +
        `<rect x="36" y="97" width="28" height="7" rx="1.5" fill="none" stroke="#2D7A42" stroke-width="0.7" opacity="0.5"/>` +
        `<g opacity="0.5" stroke="#1A5A2A" stroke-width="0.5">` +
        `<line x1="40" y1="99" x2="40" y2="102"/>` +
        `<line x1="44" y1="99" x2="44" y2="102"/>` +
        `<line x1="48" y1="99" x2="48" y2="102"/>` +
        `<line x1="52" y1="99" x2="52" y2="102"/>` +
        `<line x1="56" y1="99" x2="56" y2="102"/>` +
        `<line x1="60" y1="99" x2="60" y2="102"/>` +
        `</g>` +
        `<line x1="12" y1="2" x2="35" y2="2" stroke="#C8ECD5" stroke-width="0.7" opacity="0.3" stroke-linecap="round"/>` +
        `<line x1="65" y1="98" x2="88" y2="98" stroke="#C8ECD5" stroke-width="0.7" opacity="0.3" stroke-linecap="round"/>` +
        `<line x1="2" y1="30" x2="2" y2="50" stroke="#C8ECD5" stroke-width="0.5" opacity="0.2" stroke-linecap="round"/>` +
        `<path d="M0,30 L-2,30 L-2,34 L0,34" fill="none" stroke="#388E4E" stroke-width="0.5" opacity="0.3"/>` +
        `<path d="M0,42 L-2,42 L-2,46 L0,46" fill="none" stroke="#388E4E" stroke-width="0.5" opacity="0.3"/>` +
        `<path d="M100,54 L102,54 L102,58 L100,58" fill="none" stroke="#388E4E" stroke-width="0.5" opacity="0.3"/>` +
        `<path d="M100,66 L102,66 L102,70 L100,70" fill="none" stroke="#388E4E" stroke-width="0.5" opacity="0.3"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
JadeSealFrame.displayName = 'JadeSealFrame';

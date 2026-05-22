/** ObsidianEdgeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const ObsidianEdgeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#0A0A0A" stop-opacity="1"/>` +
        `<stop offset="0.5" stop-color="#1A1A1A" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#0A0A0A" stop-opacity="1"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#4169E1" stop-opacity="0.6"/>` +
        `<stop offset="0.25" stop-color="#9B59B6" stop-opacity="0.5"/>` +
        `<stop offset="0.5" stop-color="#E74C3C" stop-opacity="0.45"/>` +
        `<stop offset="0.75" stop-color="#F1C40F" stop-opacity="0.4"/>` +
        `<stop offset="1" stop-color="#2ECC71" stop-opacity="0.5"/>` +
        `</linearGradient>` +
        `<linearGradient id="c" x1="1" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#2ECC71" stop-opacity="0.3"/>` +
        `<stop offset="0.5" stop-color="#E74C3C" stop-opacity="0.2"/>` +
        `<stop offset="1" stop-color="#4169E1" stop-opacity="0.3"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="2" y="2" width="100" height="100" rx="${rxVal}" fill="none" stroke="#000" stroke-width="6" opacity="0.35"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5.5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#c)" stroke-width="1"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#222" stroke-width="0.6" opacity="0.5"/>` +
        `<g stroke-linecap="round" opacity="0.6">` +
        `<line x1="20" y1="0" x2="22" y2="-3.5" stroke="#4169E1" stroke-width="0.9"/>` +
        `<line x1="35" y1="0" x2="34" y2="-2.5" stroke="#9B59B6" stroke-width="0.7"/>` +
        `<line x1="50" y1="0" x2="50" y2="-3" stroke="#E74C3C" stroke-width="0.9"/>` +
        `<line x1="65" y1="0" x2="66" y2="-2.5" stroke="#F1C40F" stroke-width="0.7"/>` +
        `<line x1="80" y1="0" x2="78" y2="-3.5" stroke="#2ECC71" stroke-width="0.9"/>` +
        `</g>` +
        `<g stroke-linecap="round" opacity="0.6">` +
        `<line x1="20" y1="100" x2="22" y2="103.5" stroke="#2ECC71" stroke-width="0.9"/>` +
        `<line x1="35" y1="100" x2="34" y2="102.5" stroke="#F1C40F" stroke-width="0.7"/>` +
        `<line x1="50" y1="100" x2="50" y2="103" stroke="#4169E1" stroke-width="0.9"/>` +
        `<line x1="65" y1="100" x2="66" y2="102.5" stroke="#E74C3C" stroke-width="0.7"/>` +
        `<line x1="80" y1="100" x2="78" y2="103.5" stroke="#9B59B6" stroke-width="0.9"/>` +
        `</g>` +
        `<g stroke-linecap="round" opacity="0.55">` +
        `<line x1="0" y1="25" x2="-3" y2="24" stroke="#9B59B6" stroke-width="0.8"/>` +
        `<line x1="0" y1="40" x2="-2.5" y2="41" stroke="#E74C3C" stroke-width="0.7"/>` +
        `<line x1="0" y1="60" x2="-3" y2="59" stroke="#4169E1" stroke-width="0.8"/>` +
        `<line x1="0" y1="75" x2="-2.5" y2="76" stroke="#2ECC71" stroke-width="0.7"/>` +
        `</g>` +
        `<g stroke-linecap="round" opacity="0.55">` +
        `<line x1="100" y1="25" x2="103" y2="24" stroke="#2ECC71" stroke-width="0.8"/>` +
        `<line x1="100" y1="40" x2="102.5" y2="41" stroke="#F1C40F" stroke-width="0.7"/>` +
        `<line x1="100" y1="60" x2="103" y2="59" stroke="#9B59B6" stroke-width="0.8"/>` +
        `<line x1="100" y1="75" x2="102.5" y2="76" stroke="#4169E1" stroke-width="0.7"/>` +
        `</g>` +
        `<g stroke="#333" stroke-width="1.8" opacity="0.6">` +
        `<path d="M4,0 L0,4" fill="none"/>` +
        `<path d="M96,0 L100,4" fill="none"/>` +
        `<path d="M0,96 L4,100" fill="none"/>` +
        `<path d="M96,100 L100,96" fill="none"/>` +
        `</g>` +
        `<circle cx="2" cy="2" r="1.5" fill="#4169E1" opacity="0.4"/>` +
        `<circle cx="98" cy="2" r="1.5" fill="#2ECC71" opacity="0.4"/>` +
        `<circle cx="2" cy="98" r="1.5" fill="#F1C40F" opacity="0.4"/>` +
        `<circle cx="98" cy="98" r="1.5" fill="#E74C3C" opacity="0.4"/>` +
        `<path d="M48,-1 L50,-4 L52,-1" fill="#1A1A1A" stroke="#4169E1" stroke-width="0.5" opacity="0.5"/>` +
        `<path d="M48,101 L50,104 L52,101" fill="#1A1A1A" stroke="#E74C3C" stroke-width="0.5" opacity="0.5"/>` +
        `<path d="M-1,48 L-4,50 L-1,52" fill="#1A1A1A" stroke="#9B59B6" stroke-width="0.5" opacity="0.5"/>` +
        `<path d="M101,48 L104,50 L101,52" fill="#1A1A1A" stroke="#2ECC71" stroke-width="0.5" opacity="0.5"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
ObsidianEdgeFrame.displayName = 'ObsidianEdgeFrame';

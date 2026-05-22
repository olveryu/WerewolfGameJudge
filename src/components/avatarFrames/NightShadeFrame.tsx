/** NightShadeFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const NightShadeFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#3A1B5E" stop-opacity="0.9"/>` +
        `<stop offset="0.4" stop-color="#2A1040" stop-opacity="1"/>` +
        `<stop offset="0.7" stop-color="#1A0828" stop-opacity="1"/>` +
        `<stop offset="1" stop-color="#3A1B5E" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `<linearGradient id="b" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#7B52AB" stop-opacity="0"/>` +
        `<stop offset="0.45" stop-color="#9B72CB" stop-opacity="0.35"/>` +
        `<stop offset="0.55" stop-color="#7B52AB" stop-opacity="0"/>` +
        `</linearGradient>` +
        `<radialGradient id="c" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="#E0C8FF" stop-opacity="0.5"/>` +
        `<stop offset="0.5" stop-color="#9B72CB" stop-opacity="0.15"/>` +
        `<stop offset="1" stop-color="#3A1B5E" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<rect x="1" y="1" width="100" height="100" rx="${rxVal}" fill="none" stroke="#0A0515" stroke-width="6" opacity="0.18"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="5"/>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#b)" stroke-width="2"/>` +
        `<rect x="7" y="7" width="86" height="86" rx="${Math.max(rxVal - 6, 0)}" fill="none" stroke="#3A1B5E" stroke-width="0.7" opacity="0.5"/>` +
        `<circle cx="0" cy="0" r="10" fill="url(#c)"/>` +
        `<circle cx="100" cy="0" r="8" fill="url(#c)" opacity="0.7"/>` +
        `<circle cx="0" cy="100" r="7" fill="url(#c)" opacity="0.6"/>` +
        `<circle cx="100" cy="100" r="9" fill="url(#c)" opacity="0.8"/>` +
        `<g opacity="0.55">` +
        `<path d="M-1,2 A5,5 0 0,1 2,-1" fill="none" stroke="#C8A2F0" stroke-width="1.2"/>` +
        `<path d="M0,3 A4,4 0 0,1 3,0" fill="none" stroke="#E0C8FF" stroke-width="0.5"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<path d="M98,-1 A5,5 0 0,1 101,2" fill="none" stroke="#C8A2F0" stroke-width="1.2"/>` +
        `<path d="M99,0 A3.5,3.5 0 0,1 102,3" fill="none" stroke="#E0C8FF" stroke-width="0.5"/>` +
        `</g>` +
        `<g opacity="0.35" stroke="#B892E0" stroke-width="0.4" stroke-linecap="round">` +
        `<line x1="18" y1="-3" x2="28" y2="-4"/>` +
        `<line x1="28" y1="-4" x2="35" y2="-2"/>` +
        `<line x1="35" y1="-2" x2="40" y2="-5"/>` +
        `<line x1="40" y1="-5" x2="48" y2="-3"/>` +
        `</g>` +
        `<g opacity="0.55">` +
        `<circle cx="18" cy="-3" r="1" fill="#E0C8FF"/>` +
        `<circle cx="28" cy="-4" r="0.8" fill="#C8A2F0"/>` +
        `<circle cx="35" cy="-2" r="1.2" fill="#E0C8FF"/>` +
        `<circle cx="40" cy="-5" r="0.7" fill="#D8B8F0"/>` +
        `<circle cx="48" cy="-3" r="0.9" fill="#E0C8FF"/>` +
        `</g>` +
        `<g opacity="0.3" stroke="#B892E0" stroke-width="0.4" stroke-linecap="round">` +
        `<line x1="103" y1="20" x2="104" y2="30"/>` +
        `<line x1="104" y1="30" x2="102" y2="38"/>` +
        `<line x1="102" y1="38" x2="104" y2="48"/>` +
        `<line x1="104" y1="48" x2="103" y2="55"/>` +
        `</g>` +
        `<g opacity="0.45">` +
        `<circle cx="103" cy="20" r="0.8" fill="#E0C8FF"/>` +
        `<circle cx="104" cy="30" r="0.7" fill="#C8A2F0"/>` +
        `<circle cx="102" cy="38" r="1" fill="#E0C8FF"/>` +
        `<circle cx="104" cy="48" r="0.6" fill="#D8B8F0"/>` +
        `<circle cx="103" cy="55" r="0.9" fill="#E0C8FF"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<line x1="10" y1="104" x2="30" y2="100" stroke="#E0C8FF" stroke-width="0.8" stroke-linecap="round"/>` +
        `<line x1="30" y1="100" x2="38" y2="101" stroke="#C8A2F0" stroke-width="0.5" stroke-linecap="round"/>` +
        `<circle cx="10" cy="104" r="1.2" fill="#E0C8FF"/>` +
        `</g>` +
        `<g opacity="0.18" fill="none" stroke-linecap="round">` +
        `<path d="M-4,60 C5,55 10,70 0,75" stroke="#9B72CB" stroke-width="3"/>` +
        `<path d="M55,103 C60,108 75,106 80,102" stroke="#7B52AB" stroke-width="2.5"/>` +
        `</g>` +
        `<g opacity="0.4">` +
        `<circle cx="60" cy="103" r="0.6" fill="#D8B8F0"/>` +
        `<circle cx="-3" cy="45" r="0.5" fill="#E0C8FF"/>` +
        `<circle cx="85" cy="-3" r="0.7" fill="#C8A2F0"/>` +
        `</g>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
NightShadeFrame.displayName = 'NightShadeFrame';

/** FrostCrystalFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const FrostCrystalFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#A0D8F0" stop-opacity="0.9"/>` +
        `<stop offset="0.5" stop-color="#5090C0" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#203850" stop-opacity="0.85"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3.5"/>` +
        `<rect x="6" y="6" width="88" height="88" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#5090C0" stroke-width="1.2" opacity="0.5"/>` +
        `<path d="M${c + 9},${c} L${c},${c - 9} L${c - 9},${c} L${c},${c + 9} Z" fill="none" stroke="#3070A0" stroke-width="1" opacity="0.4"/>` +
        `<path d="M${c + 7},${c} L${c},${c - 7} L${c - 7},${c} L${c},${c + 7} Z" fill="#A0D8F0" opacity="0.6"/>` +
        `<path d="M${100 - c + 9},${c} L${100 - c},${c - 9} L${100 - c - 9},${c} L${100 - c},${c + 9} Z" fill="none" stroke="#3070A0" stroke-width="1" opacity="0.4"/>` +
        `<path d="M${100 - c + 7},${c} L${100 - c},${c - 7} L${100 - c - 7},${c} L${100 - c},${c + 7} Z" fill="#A0D8F0" opacity="0.6"/>` +
        `<path d="M${c + 9},${100 - c} L${c},${100 - c - 9} L${c - 9},${100 - c} L${c},${100 - c + 9} Z" fill="none" stroke="#3070A0" stroke-width="1" opacity="0.4"/>` +
        `<path d="M${c + 7},${100 - c} L${c},${100 - c - 7} L${c - 7},${100 - c} L${c},${100 - c + 7} Z" fill="#A0D8F0" opacity="0.6"/>` +
        `<path d="M${100 - c + 9},${100 - c} L${100 - c},${100 - c - 9} L${100 - c - 9},${100 - c} L${100 - c},${100 - c + 9} Z" fill="none" stroke="#3070A0" stroke-width="1" opacity="0.4"/>` +
        `<path d="M${100 - c + 7},${100 - c} L${100 - c},${100 - c - 7} L${100 - c - 7},${100 - c} L${100 - c},${100 - c + 7} Z" fill="#A0D8F0" opacity="0.6"/>` +
        `<circle cx="${c}" cy="${c}" r="1.5" fill="#E0F4FF" opacity="0.8"/>` +
        `<circle cx="${100 - c}" cy="${c}" r="1.5" fill="#E0F4FF" opacity="0.8"/>` +
        `<circle cx="${c}" cy="${100 - c}" r="1.5" fill="#E0F4FF" opacity="0.8"/>` +
        `<circle cx="${100 - c}" cy="${100 - c}" r="1.5" fill="#E0F4FF" opacity="0.8"/>` +
        `<g opacity="0.6" stroke="#A0D8F0" stroke-width="1.2" stroke-linecap="round">` +
        `<line x1="25" y1="0" x2="23" y2="-4"/>` +
        `<line x1="40" y1="0" x2="40" y2="-3"/>` +
        `<line x1="50" y1="0" x2="50" y2="-4"/>` +
        `<line x1="60" y1="0" x2="60" y2="-3"/>` +
        `<line x1="75" y1="0" x2="77" y2="-4"/>` +
        `<line x1="25" y1="100" x2="23" y2="104"/>` +
        `<line x1="40" y1="100" x2="40" y2="103"/>` +
        `<line x1="50" y1="100" x2="50" y2="104"/>` +
        `<line x1="60" y1="100" x2="60" y2="103"/>` +
        `<line x1="75" y1="100" x2="77" y2="104"/>` +
        `<line x1="0" y1="25" x2="-4" y2="23"/>` +
        `<line x1="0" y1="50" x2="-4" y2="50"/>` +
        `<line x1="0" y1="75" x2="-4" y2="77"/>` +
        `<line x1="100" y1="25" x2="104" y2="23"/>` +
        `<line x1="100" y1="50" x2="104" y2="50"/>` +
        `<line x1="100" y1="75" x2="104" y2="77"/>` +
        `</g>` +
        `<g opacity="0.45" stroke="#C8E8FF" stroke-width="0.8" stroke-linecap="round">` +
        `<line x1="48" y1="-2" x2="52" y2="-2"/>` +
        `<line x1="50" y1="-4" x2="50" y2="0"/>` +
        `<line x1="48" y1="102" x2="52" y2="102"/>` +
        `<line x1="50" y1="100" x2="50" y2="104"/>` +
        `<line x1="-2" y1="48" x2="-2" y2="52"/>` +
        `<line x1="-4" y1="50" x2="0" y2="50"/>` +
        `<line x1="102" y1="48" x2="102" y2="52"/>` +
        `<line x1="100" y1="50" x2="104" y2="50"/>` +
        `</g>` +
        `<circle cx="50" cy="-2" r="1.8" fill="#C8E8FF" opacity="0.8"/>` +
        `<circle cx="50" cy="102" r="1.8" fill="#C8E8FF" opacity="0.8"/>` +
        `<circle cx="-2" cy="50" r="1.8" fill="#C8E8FF" opacity="0.8"/>` +
        `<circle cx="102" cy="50" r="1.8" fill="#C8E8FF" opacity="0.8"/>` +
        `<path d="M30,100 L30,105 L32,100" fill="#5090C0" opacity="0.4"/>` +
        `<path d="M45,100 L45,106 L47,100" fill="#5090C0" opacity="0.35"/>` +
        `<path d="M55,100 L55,106 L57,100" fill="#5090C0" opacity="0.35"/>` +
        `<path d="M70,100 L70,105 L72,100" fill="#5090C0" opacity="0.4"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
FrostCrystalFrame.displayName = 'FrostCrystalFrame';

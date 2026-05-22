/** BoneGateFrame * SVG string → data URL → Image 渲染，不依赖 react-native-svg。
 */
import { memo, useMemo } from 'react';

import type { FrameProps } from './FrameProps';
import { SvgFrame } from './SvgFrame';

export const BoneGateFrame = memo<FrameProps>(({ size, rx }) => {
  const buildSvg = useMemo(
    () => (rxVal: number) => {
      const c = rxVal * 0.29;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">` +
        `<defs>` +
        `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#E0D8C8" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="#A89880" stop-opacity="0.9"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="100" height="100" rx="${rxVal}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
        `<rect x="5" y="5" width="90" height="90" rx="${Math.max(rxVal - 4, 0)}" fill="none" stroke="#B8A890" stroke-width="1.5" opacity="0.6"/>` +
        `<line x1="${c - 8}" y1="${c - 8}" x2="${c + 8}" y2="${c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${c + 8}" y1="${c - 8}" x2="${c - 8}" y2="${c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${100 - c - 8}" y1="${c - 8}" x2="${100 - c + 8}" y2="${c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${100 - c + 8}" y1="${c - 8}" x2="${100 - c - 8}" y2="${c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${c - 8}" y1="${100 - c - 8}" x2="${c + 8}" y2="${100 - c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${c + 8}" y1="${100 - c - 8}" x2="${c - 8}" y2="${100 - c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${100 - c - 8}" y1="${100 - c - 8}" x2="${100 - c + 8}" y2="${100 - c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="${100 - c + 8}" y1="${100 - c - 8}" x2="${100 - c - 8}" y2="${100 - c + 8}" stroke="#D8D0C0" stroke-width="2.5" stroke-linecap="round"/>` +
        `<circle cx="${c - 8}" cy="${c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c + 8}" cy="${c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c - 8}" cy="${c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c + 8}" cy="${c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c - 8}" cy="${c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c + 8}" cy="${c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c - 8}" cy="${c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c + 8}" cy="${c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c - 8}" cy="${100 - c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c + 8}" cy="${100 - c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c - 8}" cy="${100 - c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${c + 8}" cy="${100 - c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c - 8}" cy="${100 - c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c + 8}" cy="${100 - c - 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c - 8}" cy="${100 - c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="${100 - c + 8}" cy="${100 - c + 8}" r="2.5" fill="#E0D8C8"/>` +
        `<circle cx="50" cy="-2" r="3.5" fill="#D8D0C0" stroke="#3A3530" stroke-width="0.6"/>` +
        `<circle cx="48.5" cy="-2.8" r="0.7" fill="#3A3530"/>` +
        `<circle cx="51.5" cy="-2.8" r="0.7" fill="#3A3530"/>` +
        `<path d="M49,-0.5 L50,0.5 L51,-0.5" fill="none" stroke="#3A3530" stroke-width="0.5"/>` +
        `</svg>`
      );
    },
    [],
  );

  return <SvgFrame size={size} rx={rx} buildSvg={buildSvg} />;
});
BoneGateFrame.displayName = 'BoneGateFrame';

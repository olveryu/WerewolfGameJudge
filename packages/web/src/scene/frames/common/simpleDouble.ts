/**
 * SimpleDoubleFrame — Double line
 *
 * Double-layer same-color border. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleDoubleFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'dblGrad';
  const innerRx = Math.max(rx - 6, 2);
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.primary}" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="1.5"/>
    <rect x="6" y="6" width="88" height="88" rx="${innerRx}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.45"/>
  `;
};

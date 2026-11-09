/**
 * SimpleDiamondFrame — Diamond
 *
 * Rounded-rect gradient border. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleDiamondFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'diamGrad';
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.4"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.75"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="2"/>
  `;
};

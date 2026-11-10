/**
 * SimpleSquareFrame - Square frame
 *
 * Right-angle square frame + inner/outer double line. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleSquareFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'squareGrad';
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.primary}" stop-opacity="0.85"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="2"/>
  `;
};

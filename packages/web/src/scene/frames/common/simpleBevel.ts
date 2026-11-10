/**
 * SimpleBevelFrame — bevel.
 *
 * Border with chamfered edges and inset lines. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleBevelFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const outerGradId = 'bevelOuter';
  return `
    <defs>
      <linearGradient id="${outerGradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.6"/>
        <stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${outerGradId})" stroke-width="2"/>
  `;
};

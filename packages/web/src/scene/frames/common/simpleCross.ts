/**
 * SimpleCrossFrame — Cross
 *
 * Cross-shaped clip border (4 concave corners). Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

/**
 * Build a cross-cut path: rectangle with concave corners.
 * `inset` controls how deep the corner cuts are.
 */
function crossPath(inset: number): string {
  const i = inset;
  return [
    `M ${i} 0`,
    `L ${100 - i} 0`,
    `L ${100 - i} ${i}`,
    `L 100 ${i}`,
    `L 100 ${100 - i}`,
    `L ${100 - i} ${100 - i}`,
    `L ${100 - i} 100`,
    `L ${i} 100`,
    `L ${i} ${100 - i}`,
    `L 0 ${100 - i}`,
    `L 0 ${i}`,
    `L ${i} ${i}`,
    'Z',
  ].join(' ');
}

export const simpleCrossFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'crossGrad';
  const inset = Math.min(rx * 0.5, 18);
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${colors.dark}" stop-opacity="0.65"/>
        <stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <path d="${crossPath(inset)}" fill="none" stroke="url(#${gradId})" stroke-width="2" stroke-linejoin="round"/>
  `;
};

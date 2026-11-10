/**
 * SimpleOctagonFrame — Octagon
 *
 * Octagonal border clip. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

/** Generate the octagon path (viewBox 100×100; corner cut size is rx-related). */
function octagonPath(cut: number): string {
  return [
    `M ${cut} 0`,
    `L ${100 - cut} 0`,
    `L 100 ${cut}`,
    `L 100 ${100 - cut}`,
    `L ${100 - cut} 100`,
    `L ${cut} 100`,
    `L 0 ${100 - cut}`,
    `L 0 ${cut}`,
    'Z',
  ].join(' ');
}

export const simpleOctagonFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'octGrad';
  const cut = Math.min(rx * 0.7, 25);
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.4"/>
        <stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.75"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <path d="${octagonPath(cut)}" fill="none" stroke="url(#${gradId})" stroke-width="2" stroke-linejoin="round"/>
  `;
};

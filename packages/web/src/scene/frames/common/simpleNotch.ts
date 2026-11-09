/**
 * SimpleNotchFrame — notched corners
 *
 * Triangular notch at each of the 4 corners. Common-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

/** Rectangle with triangle notches at all 4 corners. */
function notchPath(n: number): string {
  return [
    `M ${n} 0`,
    `L ${100 - n} 0`,
    `L 100 ${n}`,
    `L 100 ${100 - n}`,
    `L ${100 - n} 100`,
    `L ${n} 100`,
    `L 0 ${100 - n}`,
    `L 0 ${n}`,
    'Z',
  ].join(' ');
}

export const simpleNotchFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'notchGrad';
  const notch = Math.min(rx * 0.6, 15);
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <path d="${notchPath(notch)}" fill="none" stroke="url(#${gradId})" stroke-width="2" stroke-linejoin="round"/>
  `;
};

/**
 * FiligreeFrame — filigree pattern
 *
 * Corner scrollwork arcs on each corner + main border.
 * Rare-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const filigreeFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gBorder = 'filBord';
  // Small scroll arcs at each corner
  const a = 18; // arc size
  const scrollPaths = [
    // Top-left corner scrollwork
    `M ${a} 0 Q 0 0 0 ${a}`,
    `M ${a + 4} 4 Q 4 4 4 ${a + 4}`,
    // Top-right
    `M ${100 - a} 0 Q 100 0 100 ${a}`,
    `M ${100 - a - 4} 4 Q 96 4 96 ${a + 4}`,
    // Bottom-right
    `M 100 ${100 - a} Q 100 100 ${100 - a} 100`,
    `M 96 ${100 - a - 4} Q 96 96 ${100 - a - 4} 96`,
    // Bottom-left
    `M 0 ${100 - a} Q 0 100 ${a} 100`,
    `M 4 ${100 - a - 4} Q 4 96 ${a + 4} 96`,
  ];
  return `
    <defs>
      <linearGradient id="${gBorder}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.7"/>
        <stop offset="0.4" stop-color="${colors.primary}" stop-opacity="0.95"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gBorder})" stroke-width="3"/>${scrollPaths
      .map(
        (d) => `
    <path d="${d}" fill="none" stroke="${colors.light}" stroke-width="1.5" opacity="0.8" stroke-linecap="round"/>`,
      )
      .join('')}
  `;
};

/**
 * GemFrame — Gem
 *
 * Border with small diamond-shaped decorations at the 4 midpoints of each edge.
 * Rare-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

/** Small diamond at (cx, cy) with half-size s */
function diamondAt(cx: number, cy: number, s: number): string {
  return `M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`;
}

export const gemFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gBorder = 'gemB';
  const gemSize = 5;
  return `
    <defs>
      <linearGradient id="${gBorder}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.primary}" stop-opacity="0.9"/>
        <stop offset="0.4" stop-color="${colors.light}" stop-opacity="0.8"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gBorder})" stroke-width="3"/>
    <path d="${diamondAt(50, 0, gemSize)}" fill="${colors.light}" opacity="0.85"/>
    <path d="${diamondAt(100, 50, gemSize)}" fill="${colors.light}" opacity="0.85"/>
    <path d="${diamondAt(50, 100, gemSize)}" fill="${colors.light}" opacity="0.85"/>
    <path d="${diamondAt(0, 50, gemSize)}" fill="${colors.light}" opacity="0.85"/>
    <rect x="5" y="5" width="90" height="90" rx="${Math.max(rx - 5, 2)}" fill="none" stroke="${colors.primary}" stroke-width="0.8" opacity="0.45"/>
  `;
};

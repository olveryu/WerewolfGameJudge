/**
 * ChainFrame -- Chain
 *
 * Linked oval "chain" pattern along the border.
 * Rare-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

/** Build chain link positions along one edge */
function edgeLinks(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count: number,
): { cx: number; cy: number; angle: number }[] {
  const links: { cx: number; cy: number; angle: number }[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    links.push({ cx: x1 + dx * t, cy: y1 + dy * t, angle });
  }
  return links;
}

export const chainFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gBorder = 'chainB';
  const links = [
    ...edgeLinks(0, 0, 100, 0, 6), // top
    ...edgeLinks(100, 0, 100, 100, 6), // right
    ...edgeLinks(100, 100, 0, 100, 6), // bottom
    ...edgeLinks(0, 100, 0, 0, 6), // left
  ];
  return `
    <defs>
      <linearGradient id="${gBorder}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.primary}" stop-opacity="0.85"/>
        <stop offset="0.5" stop-color="${colors.light}" stop-opacity="0.6"/>
        <stop offset="1" stop-color="${colors.dark}" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gBorder})" stroke-width="2.5"/>${links
      .map(
        (link) => `
    <ellipse cx="${link.cx}" cy="${link.cy}" rx="5" ry="3" fill="none" stroke="${colors.light}" stroke-width="1.3" opacity="0.75" transform="rotate(${link.angle})"/>`,
      )
      .join('')}
  `;
};

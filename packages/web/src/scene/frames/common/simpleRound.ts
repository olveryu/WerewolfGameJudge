/**
 * SimpleRoundFrame — Round Ring
 *
 * Solid-color circular border + subtle outer glow. Common-tier avatar frame template.
 * Accepts FrameProps + color; color variants are injected by the factory.
 */
import type { ColoredFrameArt } from '../frameArt';

export const simpleRoundFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gradId = 'roundGrad';
  return `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.75"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="2"/>
  `;
};

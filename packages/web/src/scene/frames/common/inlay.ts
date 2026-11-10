/**
 * InlayFrame — Inlay
 *
 * Thick outer border with a colored inlay stripe running inside.
 * Rare-tier avatar frame template — visually richer than common (3-layer border stack).
 */
import type { ColoredFrameArt } from '../frameArt';

export const inlayFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gOuter = 'inlayO';
  const gInlay = 'inlayI';
  const midRx = Math.max(rx - 3, 2);
  const innerRx = Math.max(rx - 6, 2);
  return `
    <defs>
      <linearGradient id="${gOuter}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.dark}" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="${colors.light}" stop-opacity="0.6"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.9"/>
      </linearGradient>
      <linearGradient id="${gInlay}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gOuter})" stroke-width="4"/>
    <rect x="4" y="4" width="92" height="92" rx="${midRx}" fill="none" stroke="url(#${gInlay})" stroke-width="2.5"/>
    <rect x="7" y="7" width="86" height="86" rx="${innerRx}" fill="none" stroke="${colors.dark}" stroke-width="1" opacity="0.5"/>
  `;
};

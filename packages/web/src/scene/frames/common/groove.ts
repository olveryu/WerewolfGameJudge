/**
 * GrooveFrame — Grooved
 *
 * Triple-line border with highlight/shadow to simulate an engraved groove.
 * Rare-tier avatar frame template.
 */
import type { ColoredFrameArt } from '../frameArt';

export const grooveFrameArt: ColoredFrameArt = ({ rx, colors }) => {
  const gOuter = 'grooveO';
  const gInner = 'grooveI';
  const midRx = Math.max(rx - 3, 2);
  const innerRx = Math.max(rx - 6, 2);
  return `
    <defs>
      <linearGradient id="${gOuter}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.light}" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="${colors.primary}" stop-opacity="0.7"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.8"/>
      </linearGradient>
      <linearGradient id="${gInner}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.dark}" stop-opacity="0.85"/>
        <stop offset="1" stop-color="${colors.primary}" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.2"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${gOuter})" stroke-width="3"/>
    <rect x="3" y="3" width="94" height="94" rx="${midRx}" fill="none" stroke="${colors.primary}" stroke-width="3" opacity="0.55"/>
    <rect x="6" y="6" width="88" height="88" rx="${innerRx}" fill="none" stroke="url(#${gInner})" stroke-width="2"/>
  `;
};

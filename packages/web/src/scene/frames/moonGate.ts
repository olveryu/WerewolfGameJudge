/**
 * MoonGateFrame — Moon Gate
 *
 * Silver-white moon arch · crescent hooks extending outward at four corners · scattered star dots · moon halo arcs.
 */
import { staticFrame } from './frameArt';

/** 月门 */
export const moonGateFrame = staticFrame('moonGate', ({ rx }) => {
  const mainG = 'mgM';
  return `
    <defs>
      <linearGradient id="${mainG}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#D5D8DC" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#ABB2B9" stop-opacity="1"/>
        <stop offset="1" stop-color="#D5D8DC" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="-1" y="-1" width="102" height="102" rx="${rx + 1}" fill="none" stroke="#E8E8F0" stroke-width="1.5" opacity="0.3"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${mainG})" stroke-width="4"/>
    <rect x="5" y="5" width="90" height="90" rx="${Math.max(rx - 4, 0)}" fill="none" stroke="#E8E8F0" stroke-width="0.6" opacity="0.4"/>
    <path d="M-2,-2 Q-7,-2 -7,5 Q-4,2 -2,0 Z" fill="#C0C5CC" stroke="#E8E8F0" stroke-width="0.5" opacity="0.8"/>
    <path d="M102,-2 Q107,-2 107,5 Q104,2 102,0 Z" fill="#C0C5CC" stroke="#E8E8F0" stroke-width="0.5" opacity="0.8"/>
    <path d="M-2,102 Q-7,102 -7,95 Q-4,98 -2,100 Z" fill="#C0C5CC" stroke="#E8E8F0" stroke-width="0.5" opacity="0.8"/>
    <path d="M102,102 Q107,102 107,95 Q104,98 102,100 Z" fill="#C0C5CC" stroke="#E8E8F0" stroke-width="0.5" opacity="0.8"/>
    <path d="M35,-2 Q50,-10 65,-2" fill="none" stroke="#D5D8DC" stroke-width="2" opacity="0.7"/>
    <path d="M38,-1 Q50,-7 62,-1" fill="none" stroke="#E8E8F0" stroke-width="0.8" opacity="0.5"/>
    <path d="M35,102 Q50,110 65,102" fill="none" stroke="#D5D8DC" stroke-width="2" opacity="0.7"/>
    <path d="M-2,35 Q-8,50 -2,65" fill="none" stroke="#D5D8DC" stroke-width="1.8" opacity="0.6"/>
    <path d="M102,35 Q108,50 102,65" fill="none" stroke="#D5D8DC" stroke-width="1.8" opacity="0.6"/>
    <circle cx="50" cy="-6" r="1.5" fill="#F0F0F8" opacity="0.8"/>
    <circle cx="30" cy="-4" r="1" fill="#E8E8F0" opacity="0.7"/>
    <circle cx="70" cy="-4" r="1" fill="#E8E8F0" opacity="0.7"/>
    <circle cx="-4" cy="50" r="1.2" fill="#F0F0F8" opacity="0.7"/>
    <circle cx="104" cy="50" r="1.2" fill="#F0F0F8" opacity="0.7"/>
    <circle cx="50" cy="106" r="1.5" fill="#F0F0F8" opacity="0.8"/>
    <circle cx="15" cy="-3" r="0.6" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="85" cy="-3" r="0.6" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="-3" cy="20" r="0.6" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="103" cy="80" r="0.6" fill="#FFFFFF" opacity="0.6"/>
  `;
});

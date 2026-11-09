/**
 * StormWeaveFrame — Storm Weave
 *
 * Storm blue-gray frame; lightning bolts from the four corners; wind spiral motifs; arc nodes.
 */
import { staticFrame } from './frameArt';

/** 风暴织 */
export const stormWeaveFrame = staticFrame('stormWeave', ({ rx }) => {
  const mainG = 'swM';
  return `
    <defs>
      <linearGradient id="${mainG}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5D6D7E" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#2C3E50" stop-opacity="1"/>
        <stop offset="1" stop-color="#5D6D7E" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="100" height="100" rx="${rx}" fill="none" stroke="#0A1520" stroke-width="6" opacity="0.18"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${mainG})" stroke-width="4.5"/>
    <path d="M-2,-2 L4,-6 L2,2 L8,-3 L5,5" fill="none" stroke="#F4D03F" stroke-width="1.5" opacity="0.8" stroke-linejoin="bevel"/>
    <path d="M102,-2 L96,-6 L98,2 L92,-3 L95,5" fill="none" stroke="#F4D03F" stroke-width="1.5" opacity="0.8" stroke-linejoin="bevel"/>
    <path d="M-2,102 L4,106 L2,98 L8,103 L5,95" fill="none" stroke="#F4D03F" stroke-width="1.5" opacity="0.8" stroke-linejoin="bevel"/>
    <path d="M102,102 L96,106 L98,98 L92,103 L95,95" fill="none" stroke="#F4D03F" stroke-width="1.5" opacity="0.8" stroke-linejoin="bevel"/>
    <path d="M-2,-2 L4,-6 L2,2" fill="none" stroke="#FDEBD0" stroke-width="0.5" opacity="0.5"/>
    <path d="M102,-2 L96,-6 L98,2" fill="none" stroke="#FDEBD0" stroke-width="0.5" opacity="0.5"/>
    <path d="M20,0 Q25,-4 30,-2 Q35,-5 40,0" fill="none" stroke="#85929E" stroke-width="1.2" opacity="0.6"/>
    <path d="M55,0 Q60,-4 65,-2 Q70,-5 75,0" fill="none" stroke="#85929E" stroke-width="1.2" opacity="0.6"/>
    <path d="M25,100 Q30,104 35,102 Q40,105 45,100" fill="none" stroke="#85929E" stroke-width="1.2" opacity="0.6"/>
    <path d="M60,100 Q65,104 70,102 Q75,105 80,100" fill="none" stroke="#85929E" stroke-width="1.2" opacity="0.6"/>
    <path d="M0,25 Q-3,30 0,35" fill="none" stroke="#85929E" stroke-width="1" opacity="0.5"/>
    <path d="M0,60 Q-3,65 0,70" fill="none" stroke="#85929E" stroke-width="1" opacity="0.5"/>
    <path d="M100,30 Q103,35 100,40" fill="none" stroke="#85929E" stroke-width="1" opacity="0.5"/>
    <path d="M100,65 Q103,70 100,75" fill="none" stroke="#85929E" stroke-width="1" opacity="0.5"/>
    <circle cx="0" cy="0" r="2" fill="#F4D03F" opacity="0.6"/>
    <circle cx="100" cy="0" r="2" fill="#F4D03F" opacity="0.6"/>
    <circle cx="0" cy="100" r="2" fill="#F4D03F" opacity="0.6"/>
    <circle cx="100" cy="100" r="2" fill="#F4D03F" opacity="0.6"/>
  `;
});

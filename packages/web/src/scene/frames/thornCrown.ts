/**
 * ThornCrownFrame — Thorn Crown
 *
 * Antique bronze thorn crown · thick brambles woven around · spikes jutting outward · dark ruby gems inlaid.
 */
import { staticFrame } from './frameArt';

/** 荆冠 */
export const thornCrownFrame = staticFrame('thornCrown', ({ rx }) => {
  const mainG = 'tcM';
  return `
    <defs>
      <linearGradient id="${mainG}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8B6914" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#6B4F10" stop-opacity="1"/>
        <stop offset="1" stop-color="#8B6914" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${mainG})" stroke-width="4.5"/>
    <path d="M10,0 Q15,-2 20,0 Q25,-1 30,0 Q35,-2 40,0 Q45,-1 50,0 Q55,-2 60,0 Q65,-1 70,0 Q75,-2 80,0 Q85,-1 90,0" fill="none" stroke="#6B4F10" stroke-width="2" opacity="0.7"/>
    <path d="M10,100 Q15,102 20,100 Q25,101 30,100 Q35,102 40,100 Q45,101 50,100 Q55,102 60,100 Q65,101 70,100 Q75,102 80,100 Q85,101 90,100" fill="none" stroke="#6B4F10" stroke-width="2" opacity="0.7"/>
    <path d="M18,0 L16,-6 L20,-1" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.8"/>
    <path d="M35,0 L33,-5 L37,-1" fill="#5A4110" stroke="#8B6914" stroke-width="0.5" opacity="0.75"/>
    <path d="M50,0 L48,-7 L52,-1" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.85"/>
    <path d="M65,0 L63,-5 L67,-1" fill="#5A4110" stroke="#8B6914" stroke-width="0.5" opacity="0.75"/>
    <path d="M82,0 L80,-6 L84,-1" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.8"/>
    <path d="M18,100 L16,106 L20,101" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.8"/>
    <path d="M50,100 L48,107 L52,101" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.85"/>
    <path d="M82,100 L80,106 L84,101" fill="#6B4F10" stroke="#8B6914" stroke-width="0.5" opacity="0.8"/>
    <path d="M0,20 L-5,18 L-1,22" fill="#6B4F10" opacity="0.8"/>
    <path d="M0,50 L-6,48 L-1,52" fill="#6B4F10" opacity="0.85"/>
    <path d="M0,80 L-5,78 L-1,82" fill="#6B4F10" opacity="0.8"/>
    <path d="M100,25 L105,23 L101,27" fill="#6B4F10" opacity="0.8"/>
    <path d="M100,50 L106,48 L101,52" fill="#6B4F10" opacity="0.85"/>
    <path d="M100,75 L105,73 L101,77" fill="#6B4F10" opacity="0.8"/>
    <circle cx="0" cy="0" r="3" fill="#5A4110" stroke="#8B6914" stroke-width="0.8" opacity="0.75"/>
    <circle cx="100" cy="0" r="3" fill="#5A4110" stroke="#8B6914" stroke-width="0.8" opacity="0.75"/>
    <circle cx="0" cy="100" r="3" fill="#5A4110" stroke="#8B6914" stroke-width="0.8" opacity="0.75"/>
    <circle cx="100" cy="100" r="3" fill="#5A4110" stroke="#8B6914" stroke-width="0.8" opacity="0.75"/>
    <circle cx="50" cy="-2" r="2" fill="#7B241C" stroke="#C0392B" stroke-width="0.5" opacity="0.8"/>
    <circle cx="50" cy="-2.5" r="0.6" fill="#E74C3C" opacity="0.7"/>
    <circle cx="50" cy="102" r="2" fill="#7B241C" stroke="#C0392B" stroke-width="0.5" opacity="0.8"/>
    <circle cx="50" cy="101.5" r="0.6" fill="#E74C3C" opacity="0.7"/>
  `;
});

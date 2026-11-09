/**
 * SakuraDriftFrame — Sakura Drift
 *
 * Five-petal sakura flowers at four corners + drifting petals + three-layer pink gradient + branches + buds.
 */
import { staticFrame } from './frameArt';

/** 樱散 */
export const sakuraDriftFrame = staticFrame('sakuraDrift', ({ rx }) => {
  const sakGrad = 'sakG';
  const sakGlow = 'sakGlow';
  return `
    <defs>
      <linearGradient id="${sakGrad}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFB7C5" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#E88FA0" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#D06B80" stop-opacity="0.9"/>
      </linearGradient>
      <radialGradient id="${sakGlow}" cx="50%" cy="50%" r="55%">
        <stop offset="0.6" stop-color="#FFD1DC" stop-opacity="0"/>
        <stop offset="1" stop-color="#FFB7C5" stop-opacity="0.12"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="58" fill="url(#${sakGlow})"/>
    <rect x="1" y="1" width="100" height="100" rx="${rx}" fill="none" stroke="#6B2030" stroke-width="4" opacity="0.15"/>
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#${sakGrad})" stroke-width="3"/>
    <rect x="5" y="5" width="90" height="90" rx="${Math.max(rx - 4, 0)}" fill="none" stroke="#FFD1DC" stroke-width="0.8" opacity="0.4"/>
    <g opacity="0.8" transform="translate(-3,-3)">
      <ellipse rx="4.5" ry="2" fill="#FFB7C5" transform="rotate(0)"/>
      <ellipse rx="4.5" ry="2" fill="#FF9FB2" transform="rotate(72)"/>
      <ellipse rx="4.5" ry="2" fill="#FFD1DC" transform="rotate(144)"/>
      <ellipse rx="4.5" ry="2" fill="#FFB7C5" transform="rotate(216)"/>
      <ellipse rx="4.5" ry="2" fill="#FF9FB2" transform="rotate(288)"/>
      <circle r="2" fill="#D05A70"/>
      <circle r="1" fill="#E8899A"/>
    </g>
    <g opacity="0.8" transform="translate(103,-3)">
      <ellipse rx="4.5" ry="2" fill="#FFB7C5" transform="rotate(15)"/>
      <ellipse rx="4.5" ry="2" fill="#FF9FB2" transform="rotate(87)"/>
      <ellipse rx="4.5" ry="2" fill="#FFD1DC" transform="rotate(159)"/>
      <ellipse rx="4.5" ry="2" fill="#FFB7C5" transform="rotate(231)"/>
      <ellipse rx="4.5" ry="2" fill="#FF9FB2" transform="rotate(303)"/>
      <circle r="2" fill="#D05A70"/>
      <circle r="1" fill="#E8899A"/>
    </g>
    <g opacity="0.8" transform="translate(-3,103)">
      <ellipse rx="4" ry="1.8" fill="#FFB7C5" transform="rotate(10)"/>
      <ellipse rx="4" ry="1.8" fill="#FF9FB2" transform="rotate(82)"/>
      <ellipse rx="4" ry="1.8" fill="#FFD1DC" transform="rotate(154)"/>
      <ellipse rx="4" ry="1.8" fill="#FFB7C5" transform="rotate(226)"/>
      <ellipse rx="4" ry="1.8" fill="#FF9FB2" transform="rotate(298)"/>
      <circle r="1.8" fill="#D05A70"/>
      <circle r="0.9" fill="#E8899A"/>
    </g>
    <g opacity="0.75" transform="translate(103,103)">
      <ellipse rx="4" ry="1.8" fill="#FFB7C5" transform="rotate(25)"/>
      <ellipse rx="4" ry="1.8" fill="#FF9FB2" transform="rotate(97)"/>
      <ellipse rx="4" ry="1.8" fill="#FFD1DC" transform="rotate(169)"/>
      <ellipse rx="4" ry="1.8" fill="#FFB7C5" transform="rotate(241)"/>
      <ellipse rx="4" ry="1.8" fill="#FF9FB2" transform="rotate(313)"/>
      <circle r="1.8" fill="#D05A70"/>
      <circle r="0.9" fill="#E8899A"/>
    </g>
    <ellipse cx="30" cy="-5" rx="3.5" ry="1.4" fill="#FFB7C5" opacity="0.65" transform="rotate(35)"/>
    <ellipse cx="55" cy="-4" rx="2.8" ry="1.2" fill="#FFD1DC" opacity="0.55" transform="rotate(-20)"/>
    <ellipse cx="70" cy="105" rx="3.2" ry="1.3" fill="#FF9FB2" opacity="0.6" transform="rotate(-25)"/>
    <ellipse cx="35" cy="106" rx="2.5" ry="1.1" fill="#FFB7C5" opacity="0.5" transform="rotate(50)"/>
    <ellipse cx="-5" cy="40" rx="3" ry="1.2" fill="#FFD1DC" opacity="0.55" transform="rotate(60)"/>
    <ellipse cx="-4" cy="70" rx="2.5" ry="1" fill="#FF9FB2" opacity="0.5" transform="rotate(-40)"/>
    <ellipse cx="105" cy="30" rx="2.8" ry="1.2" fill="#FFB7C5" opacity="0.5" transform="rotate(15)"/>
    <ellipse cx="106" cy="65" rx="3" ry="1.1" fill="#FFD1DC" opacity="0.45" transform="rotate(-55)"/>
    <g opacity="0.55">
      <circle cx="50" cy="-2" r="2" fill="#FFB7C5"/>
      <circle cx="50" cy="-2" r="0.8" fill="#D05A70"/>
      <circle cx="50" cy="102" r="2" fill="#FFB7C5"/>
      <circle cx="50" cy="102" r="0.8" fill="#D05A70"/>
      <circle cx="-2" cy="50" r="1.8" fill="#FF9FB2"/>
      <circle cx="-2" cy="50" r="0.7" fill="#D05A70"/>
      <circle cx="102" cy="50" r="1.8" fill="#FF9FB2"/>
      <circle cx="102" cy="50" r="0.7" fill="#D05A70"/>
    </g>
    <path d="M8,0 Q15,-3 22,0" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>
    <path d="M78,0 Q85,-3 92,0" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>
    <path d="M8,100 Q15,103 22,100" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>
    <path d="M78,100 Q85,103 92,100" fill="none" stroke="#C07888" stroke-width="0.6" opacity="0.4"/>
  `;
});

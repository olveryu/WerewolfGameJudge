/** 水晶球 (tarot reveal): a crystal ball with a pulsing nebula and twinkling stars inside. */
import type { DecorationSpec, DotSampler } from '@/scene/decoration';

import { petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 3200;
const LOOP_MS = 3000;

function nebulaSampler(cx: number, cy: number, r: number, base: number, phase: number) {
  const sampler: DotSampler = (t, size) => ({
    cx: petUnitsToPx(cx, size),
    cy: petUnitsToPx(cy, size),
    r: petUnitsToPx(r, size),
    opacity: base + Math.sin(t * Math.PI * 2 + phase) * base,
  });
  return sampler;
}

function starSampler(cx: number, cy: number, r: number, base: number, phase: number) {
  const sampler: DotSampler = (t, size) => {
    const s = 0.5 + Math.sin(t * Math.PI * 4 + phase) * 0.5;
    return {
      cx: petUnitsToPx(cx, size),
      cy: petUnitsToPx(cy, size),
      r: petUnitsToPx(r * s + base, size),
      opacity: s,
    };
  };
  return sampler;
}

const ballArt = petSvg(`
  <defs>
    <radialGradient id="crystalGrad" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#c8b6ff"/>
      <stop offset="50%" stop-color="#7b68ee"/>
      <stop offset="100%" stop-color="#3d2b6e"/>
    </radialGradient>
  </defs>
  <ellipse cx="36" cy="56" rx="14" ry="4" fill="#4a3d6e"/>
  <rect x="28" y="52" width="16" height="6" rx="2" fill="#5a4d7e"/>
  <circle cx="36" cy="36" r="16" fill="url(#crystalGrad)"/>`);

const highlightArt = petSvg(
  '<ellipse cx="30" cy="28" rx="5" ry="3" fill="rgba(255,255,255,0.25)" transform="rotate(-30 30 28)"/>',
);

export const crystalPet: DecorationSpec = {
  id: 'tarot',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: ballArt },
      {
        kind: 'dot',
        sample: nebulaSampler(32, 32, 6, 0.1, 0),
        durationMs: LOOP_MS,
        color: 'rgba(200,180,255,0.2)',
      },
      {
        kind: 'dot',
        sample: nebulaSampler(40, 38, 4, 0.08, 2),
        durationMs: LOOP_MS,
        color: 'rgba(255,200,255,0.15)',
      },
      { kind: 'dot', sample: starSampler(30, 30, 1, 0.5, 0), durationMs: LOOP_MS, color: '#fff' },
      {
        kind: 'dot',
        sample: starSampler(42, 34, 0.8, 0.3, 1.4),
        durationMs: LOOP_MS,
        color: '#fff',
      },
      {
        kind: 'dot',
        sample: starSampler(35, 40, 0.6, 0.2, 2.8),
        durationMs: LOOP_MS,
        color: '#fff',
      },
      { kind: 'svg', art: highlightArt },
    ]),
  ],
};

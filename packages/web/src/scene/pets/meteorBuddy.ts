/** 陨石仔 (meteor strike reveal): a meteor with a flickering flame tail and a pulsing glow ring. */
import type { DecorationSpec, LayerSampler, RingSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2000;
const FLAME_LOOP_MS = 800;
const PULSE_LOOP_MS = 2000;

// prettier-ignore
const FLAME_SEEDS = [
  { cx: 36, cy: 58, rx: 8, ryBase: 10, ryAmp: 1.5, fBase: 0.7, phase: 0, fill: '#ff6b35', boxUnits: 24 },
  { cx: 33, cy: 60, rx: 5, ryBase: 8, ryAmp: 1.2, fBase: 0.5, phase: 1, fill: '#ff9a3c', boxUnits: 20 },
  { cx: 39, cy: 59, rx: 4, ryBase: 7, ryAmp: 1, fBase: 0.4, phase: 2, fill: '#ffcc02', boxUnits: 18 },
] as const;

type FlameSeed = (typeof FLAME_SEEDS)[number];

/** Flame flicker: opacity and a vertical stretch. */
function flameSampler(seed: FlameSeed): LayerSampler {
  return (t, size) => {
    const wave = Math.sin(t * Math.PI * 2 + seed.phase);
    return {
      x: petUnitsToPx(seed.cx, size),
      y: petUnitsToPx(seed.cy, size),
      rotateDeg: 0,
      scaleX: 1,
      scaleY: (seed.ryBase + wave * seed.ryAmp) / seed.ryBase,
      opacity: seed.fBase + wave * 0.3,
    };
  };
}

const glowRingSampler: RingSampler = (t, size) => ({
  cx: petUnitsToPx(36, size),
  cy: petUnitsToPx(34, size),
  r: petUnitsToPx(18, size),
  strokeWidth: petUnitsToPx(0.5, size),
  opacity: 0.2 + Math.sin(t * Math.PI * 2) * 0.15,
});

const bodyArt = petSvg(`
  <defs>
    <radialGradient id="meteorGrad" cx="35%" cy="30%">
      <stop offset="0%" stop-color="#c4a882"/>
      <stop offset="100%" stop-color="#6b5340"/>
    </radialGradient>
  </defs>
  <circle cx="36" cy="34" r="16" fill="url(#meteorGrad)"/>
  <circle cx="30" cy="38" r="3" fill="rgba(0,0,0,0.15)"/>
  <circle cx="42" cy="32" r="2" fill="rgba(0,0,0,0.1)"/>
  <circle cx="34" cy="44" r="2" fill="rgba(0,0,0,0.1)"/>
  <circle cx="31" cy="31" r="2.5" fill="#fff"/>
  <circle cx="41" cy="31" r="2.5" fill="#fff"/>
  <circle cx="31.5" cy="31" r="1.5" fill="#1a1a2e"/>
  <circle cx="41.5" cy="31" r="1.5" fill="#1a1a2e"/>
  <path d="M34 36 Q36 38 38 36" stroke="#4a3628" stroke-width="0.8" fill="none" stroke-linecap="round"/>`);

export const meteorBuddyPet: DecorationSpec = {
  id: 'meteorStrike',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      ...FLAME_SEEDS.map((seed) =>
        boxLayer(
          flameSampler(seed),
          FLAME_LOOP_MS,
          seed.boxUnits,
          boxSvg(
            seed,
            seed.boxUnits,
            `<ellipse cx="${seed.cx}" cy="${seed.cy}" rx="${seed.rx}" ry="${seed.ryBase}" fill="${seed.fill}"/>`,
          ),
        ),
      ),
      { kind: 'svg', art: bodyArt },
      { kind: 'ring', sample: glowRingSampler, durationMs: PULSE_LOOP_MS, color: '#ff9a3c' },
    ]),
  ],
};

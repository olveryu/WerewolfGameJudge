/** 胶片虫 (film rewind reveal): a film-strip bug pedalling four legs. */
import type { DecorationSpec, LineSampler } from '@/scene/decoration';

import { petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 3000;
const LOOP_MS = 1200;
const LEG_STROKE = '#3d3d3d';
const LEG_STROKE_WIDTH = 2;

/** A leg from its hip to its foot pulled by `dx` units (along both axes, as the original did). */
function legSampler(
  hip: readonly [number, number],
  foot: readonly [number, number],
  phase: number,
  amplitude: number,
) {
  const sampler: LineSampler = (t, size) => {
    const dx = Math.sin(t * Math.PI * 2 + phase) * amplitude;
    return {
      x1: petUnitsToPx(hip[0], size),
      y1: petUnitsToPx(hip[1], size),
      x2: petUnitsToPx(foot[0] + dx, size),
      y2: petUnitsToPx(foot[1] + dx, size),
      strokeWidth: petUnitsToPx(LEG_STROKE_WIDTH, size),
      opacity: 1,
    };
  };
  return sampler;
}

const holes = (y: number) =>
  [22, 28, 34, 40, 46]
    .map((x) => `<rect x="${x}" y="${y}" width="3" height="3" rx="0.5" fill="#1a1a1a"/>`)
    .join('');

const bodyArt = petSvg(`
  <rect x="20" y="26" width="32" height="24" rx="4" fill="#3d3d3d"/>
  ${holes(27)}
  ${holes(46)}
  <rect x="24" y="32" width="24" height="12" rx="1" fill="#5a4a3a"/>
  <circle cx="32" cy="37" r="2" fill="#ffd700"/>
  <circle cx="40" cy="37" r="2" fill="#ffd700"/>
  <circle cx="32" cy="37" r="1" fill="#1a1a2e"/>
  <circle cx="40" cy="37" r="1" fill="#1a1a2e"/>
  <path d="M34 40 Q36 41.5 38 40" stroke="#ffd700" stroke-width="0.8" fill="none"/>
  <line x1="30" y1="26" x2="28" y2="18" stroke="#5a5a5a" stroke-width="1"/>
  <circle cx="28" cy="17" r="2" fill="#ffd700"/>
  <line x1="42" y1="26" x2="44" y2="18" stroke="#5a5a5a" stroke-width="1"/>
  <circle cx="44" cy="17" r="2" fill="#ffd700"/>`);

export const filmBugPet: DecorationSpec = {
  id: 'filmRewind',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      {
        kind: 'line',
        sample: legSampler([26, 50], [24, 58], 0, -2),
        durationMs: LOOP_MS,
        color: LEG_STROKE,
      },
      {
        kind: 'line',
        sample: legSampler([32, 50], [30, 58], 0, -2),
        durationMs: LOOP_MS,
        color: LEG_STROKE,
      },
      {
        kind: 'line',
        sample: legSampler([40, 50], [42, 58], Math.PI, 2),
        durationMs: LOOP_MS,
        color: LEG_STROKE,
      },
      {
        kind: 'line',
        sample: legSampler([46, 50], [48, 58], Math.PI, 2),
        durationMs: LOOP_MS,
        color: LEG_STROKE,
      },
    ]),
  ],
};

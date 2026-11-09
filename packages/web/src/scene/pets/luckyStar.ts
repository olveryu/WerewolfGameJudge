/** 幸运星 (fortune wheel reveal): a star with a spinning wheel on its belly. */
import type { DecorationSpec, DotSampler, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2500;
const WHEEL_LOOP_MS = 6000;
const SPARKLE_LOOP_MS = 1500;
const WHEEL_BOX_UNITS = 12;
const WHEEL = { cx: 36, cy: 38 } as const;
const WHEEL_STROKE = '#daa520';

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
    points.push(`${cx + Math.cos(outerAngle) * outer},${cy + Math.sin(outerAngle) * outer}`);
    points.push(`${cx + Math.cos(innerAngle) * inner},${cy + Math.sin(innerAngle) * inner}`);
  }
  return points.join(' ');
}

const wheelSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(WHEEL.cx, size),
  y: petUnitsToPx(WHEEL.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function sparkleSampler(cx: number, cy: number, r: number, base: number, phase: number) {
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

const bodyArt = petSvg(`
  <polygon points="${starPoints(36, 36, 24, 10)}" fill="#ffd700" stroke="#daa520" stroke-width="1"/>
  <circle cx="32" cy="30" r="2" fill="#8b6508"/>
  <circle cx="40" cy="30" r="2" fill="#8b6508"/>
  <path d="M33 34 Q36 36.5 39 34" stroke="#8b6508" stroke-width="0.8" fill="none" stroke-linecap="round"/>`);

const wheelArt = boxSvg(
  WHEEL,
  WHEEL_BOX_UNITS,
  `<circle cx="36" cy="38" r="5" fill="none" stroke="${WHEEL_STROKE}" stroke-width="1"/>
  <line x1="36" y1="33" x2="36" y2="43" stroke="${WHEEL_STROKE}" stroke-width="0.5"/>
  <line x1="31" y1="38" x2="41" y2="38" stroke="${WHEEL_STROKE}" stroke-width="0.5"/>
  <line x1="32.5" y1="34.5" x2="39.5" y2="41.5" stroke="${WHEEL_STROKE}" stroke-width="0.5"/>
  <line x1="39.5" y1="34.5" x2="32.5" y2="41.5" stroke="${WHEEL_STROKE}" stroke-width="0.5"/>`,
);

export const luckyStarPet: DecorationSpec = {
  id: 'fortuneWheel',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      boxLayer(wheelSampler, WHEEL_LOOP_MS, WHEEL_BOX_UNITS, wheelArt),
      {
        kind: 'dot',
        sample: sparkleSampler(56, 16, 1.5, 0.3, 0),
        durationMs: SPARKLE_LOOP_MS,
        color: '#fff',
      },
      {
        kind: 'dot',
        sample: sparkleSampler(18, 18, 1.0, 0.2, 1),
        durationMs: SPARKLE_LOOP_MS,
        color: '#fff',
      },
    ]),
  ],
};

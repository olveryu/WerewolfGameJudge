/** 蛋仔 (gacha machine reveal): a capsule whose lid bounces on its seam. */
import type { DecorationSpec, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2600;
const LID_LOOP_MS = 2000;
const LID = { cx: 36, cy: 38 } as const;
const LID_BOX_UNITS = 52;

/** Lid bounce: rotation oscillating about the seam. */
const lidSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(LID.cx, size),
  y: petUnitsToPx(LID.cy, size),
  rotateDeg: Math.sin(t * Math.PI * 2) * -8,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const bottomArt = petSvg('<path d="M20 38 Q20 56 36 56 Q52 56 52 38 Z" fill="#ff6b81"/>');

const lidArt = boxSvg(
  LID,
  LID_BOX_UNITS,
  '<path d="M20 38 Q20 20 36 18 Q52 20 52 38 Z" fill="#ff4757" opacity="0.9"/>',
);

const faceArt = petSvg(`
  <line x1="20" y1="38" x2="52" y2="38" stroke="#c0392b" stroke-width="1.5"/>
  <circle cx="30" cy="36" r="4" fill="#fff"/>
  <circle cx="42" cy="36" r="4" fill="#fff"/>
  <circle cx="31" cy="36" r="2.5" fill="#1a1a2e"/>
  <circle cx="43" cy="36" r="2.5" fill="#1a1a2e"/>
  <circle cx="31.5" cy="35.5" r="0.8" fill="#fff"/>
  <circle cx="43.5" cy="35.5" r="0.8" fill="#fff"/>
  <ellipse cx="25" cy="40" rx="3" ry="2" fill="rgba(255,150,150,0.5)"/>
  <ellipse cx="47" cy="40" rx="3" ry="2" fill="rgba(255,150,150,0.5)"/>
  <ellipse cx="29" cy="56" rx="4" ry="2" fill="#e84a5f"/>
  <ellipse cx="43" cy="56" rx="4" ry="2" fill="#e84a5f"/>`);

export const capsulePet: DecorationSpec = {
  id: 'gachaMachine',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bottomArt },
      boxLayer(lidSampler, LID_LOOP_MS, LID_BOX_UNITS, lidArt),
      { kind: 'svg', art: faceArt },
    ]),
  ],
};

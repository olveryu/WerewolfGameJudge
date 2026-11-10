/** Night Sanctum (mythic): a rotating floor sigil and rising light beneath the avatar. */
import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { applyViewBox, circlePolyline, strokeDashed, svgPath } from '@/scene/art';
import type { DecorationSpec, LayerSampler, StaticArt } from '@/scene/decoration';

/** Artwork is authored in a 100 × 100 viewBox. */
const VIEWBOX = 100;
/** Sigil centre in viewBox units. */
const SIGIL_CX = 40;
const SIGIL_CY = 87;
/** Floor perspective squash. */
const SIGIL_SQUASH = 0.24;
/** Sigil artwork reaches ±35 units plus stroke; box edge in viewBox units. */
const SIGIL_BOX = 76;
/** Box of the squashed outer circle (r = 32 plus stroke), in viewBox units. */
const RIM_BOX = 68;
/** Rising ticks start at y = 86 and climb 18 units twice per loop. */
const TICKS_BASE_Y = 86;
const TICKS_RISE = 18;

const sigilSampler: LayerSampler = (t, size) => {
  const box = (SIGIL_BOX / VIEWBOX) * size;
  return { x: box / 2, y: box / 2, rotateDeg: t * 360, scaleX: 1, scaleY: 1, opacity: 1 };
};

const ticksSampler: LayerSampler = (t, size) => {
  const phase = (t * 2) % 1;
  return {
    x: size / 2,
    y: size / 2 - (phase * TICKS_RISE * size) / VIEWBOX,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: Math.sin(phase * Math.PI) * 0.8,
  };
};

const floorArt: StaticArt = (context, size) => {
  const unit = applyViewBox(context, size, VIEWBOX);
  context
    .ellipse(SIGIL_CX, 90, 32, 7.5)
    .stroke({ color: MYTHIC_COLORS.crimson, width: 1.8 * unit, alpha: 0.3 });
};

const rimArt: StaticArt = (context, size) => {
  const unit = size / VIEWBOX;
  const half = (RIM_BOX / 2) * unit;
  context
    .circle(half, half, 32 * unit)
    .stroke({ color: MYTHIC_COLORS.enamel, width: 2 * unit, alpha: 0.8 });
};

/** Sigil drawn centred on the origin. */
const sigilArt: StaticArt = (context, size) => {
  const unit = applyViewBox(context, size, VIEWBOX);
  strokeDashed(context, [{ points: circlePolyline(0, 0, 28), closed: false }], [12, 8, 3, 8], 0, {
    color: MYTHIC_COLORS.silver,
    width: 3 * unit,
  });
  context
    .path(svgPath('M0 -21 L18 10 H-18 Z M0 21 L-18 -10 H18 Z'))
    .stroke({ color: MYTHIC_COLORS.crimson, width: 2 * unit });
  context
    .path(svgPath('M-4 -35 H4 M35 -4 V4 M-4 35 H4 M-35 -4 V4'))
    .stroke({ color: MYTHIC_COLORS.pearl, width: 3 * unit });
};

const ticksArt: StaticArt = (context, size) => {
  const unit = applyViewBox(context, size, VIEWBOX);
  context
    .path(
      svgPath(`M19 ${TICKS_BASE_Y} v-4 M37 ${TICKS_BASE_Y + 3} v-7 M57 ${TICKS_BASE_Y + 1} v-3`),
    )
    .stroke({ color: MYTHIC_COLORS.crystal, width: 1.2 * unit, cap: 'round' });
};

/** Floor-perspective box centred on the sigil centre, squashed about its centre. */
function floorBox(boxUnits: number) {
  return (size: number) => {
    const unit = size / VIEWBOX;
    const box = boxUnits * unit;
    return {
      left: SIGIL_CX * unit - box / 2,
      top: SIGIL_CY * unit - box / 2,
      width: box,
      height: box,
      scaleX: 1,
      scaleY: SIGIL_SQUASH,
    };
  };
}

export const nightSanctumFlair: DecorationSpec = {
  id: 'nightSanctum',
  nodes: [
    { kind: 'static', art: floorArt },
    { kind: 'group', place: floorBox(RIM_BOX), children: [{ kind: 'static', art: rimArt }] },
    {
      kind: 'group',
      place: floorBox(SIGIL_BOX),
      children: [
        { kind: 'layer', sample: sigilSampler, art: sigilArt, durationMs: MYTHIC_LOOP_DURATION },
      ],
    },
    {
      kind: 'layer',
      sample: ticksSampler,
      box: (size) => ({ width: size, height: size }),
      art: ticksArt,
      durationMs: MYTHIC_LOOP_DURATION,
    },
  ],
};

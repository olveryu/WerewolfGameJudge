/**
 * Rune Circle: 8 geometric runes (cross, diamond, triangle, square) ride a rotating ring with a
 * wave-like pulse. Halo, glyph and centre point share one orbit and pulse, so each rune is one
 * layer.
 */
import { svgPath } from '@/scene/art';
import type { DecorationNode, DecorationSpec, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 10000;
const N = 8;
const ORBIT = 0.42;
const GLYPH_R_FRAC = 0.04;

type GlyphType = 'cross' | 'diamond' | 'triangle' | 'square';
const GLYPH_ORDER: GlyphType[] = [
  'cross',
  'diamond',
  'triangle',
  'square',
  'cross',
  'diamond',
  'triangle',
  'square',
];

const RUNE_SEEDS = GLYPH_ORDER.map((glyph, index) => ({ glyph, index }));

type RuneSeed = (typeof RUNE_SEEDS)[number];

const buildGlyphD = (glyph: GlyphType, x: number, y: number, g: number): string => {
  if (glyph === 'cross') {
    return `M ${x - g} ${y} L ${x + g} ${y} M ${x} ${y - g} L ${x} ${y + g}`;
  }
  if (glyph === 'diamond') {
    return `M ${x} ${y - g} L ${x + g} ${y} L ${x} ${y + g} L ${x - g} ${y} Z`;
  }
  if (glyph === 'triangle') {
    const h = g * 0.866;
    return `M ${x} ${y - g} L ${x + h} ${y + g * 0.5} L ${x - h} ${y + g * 0.5} Z`;
  }
  // square
  const half = g * 0.75;
  return `M ${x - half} ${y - half} L ${x + half} ${y - half} L ${x + half} ${y + half} L ${x - half} ${y + half} Z`;
};

/** `index` enters the orbit angle with the opposite sign to the pulse wave. */
function runeSampler(seed: RuneSeed): LayerSampler {
  return (t, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const orbit = ORBIT * size;
    const angle = (seed.index / N) * Math.PI * 2 + t * Math.PI * 2;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((t * N - seed.index) * Math.PI * 2) / N));
    return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: pulse };
  };
}

/** Rune centred on the origin: halo disc, glyph outline, centre point. */
function runeArt(seed: RuneSeed): StaticArt {
  return (context, size) => {
    const glyphR = size * GLYPH_R_FRAC;
    context.circle(0, 0, glyphR * 1.6).fill({ color: 'rgb(180,120,240)', alpha: 0.2 });
    context
      .path(svgPath(buildGlyphD(seed.glyph, 0, 0, glyphR)))
      .stroke({ color: 'rgb(200,160,255)', width: 1.5, alpha: 0.85 });
    context.circle(0, 0, size * 0.006).fill({ color: 'rgb(220,190,255)', alpha: 0.7 });
  };
}

const orbitArt: StaticArt = (context, size) => {
  context
    .circle(size / 2, size / 2, ORBIT * size)
    .stroke({ color: 'rgb(160,96,224)', width: 1, alpha: 0.1 });
};

const nodes: DecorationNode[] = [
  { kind: 'static', art: orbitArt },
  ...RUNE_SEEDS.map(
    (seed): DecorationNode => ({
      kind: 'layer',
      sample: runeSampler(seed),
      art: runeArt(seed),
      durationMs: LOOP_MS,
    }),
  ),
];

export const runeCircleFlair: DecorationSpec = { id: 'runeCircle', nodes };

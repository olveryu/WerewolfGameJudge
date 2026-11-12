/** Petal Dance: 8 pink petals spiral down from the top, swaying as they fall. */
import { svgPath } from '@/scene/art';
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const PETAL_COUNT = 8;
const PINK_SHADES = [
  [255, 180, 200],
  [255, 160, 190],
  [255, 200, 210],
  [240, 150, 180],
  [255, 170, 195],
  [250, 190, 205],
  [255, 155, 185],
  [245, 175, 200],
] as const;
const PETAL_STROKE_WIDTH = 0.5;

const PETAL_SEEDS = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  xOff: 0.1 + (i * 0.8) / (PETAL_COUNT - 1),
  spiralR: 0.04 + (i % 3) * 0.02,
  rotSpeed: 1 + (i % 2) * 0.5,
  phase: i / PETAL_COUNT,
  petalW: 0.015 + (i % 3) * 0.005,
  petalH: 0.025 + (i % 2) * 0.01,
  ci: i % PINK_SHADES.length,
}));

type PetalSeed = (typeof PETAL_SEEDS)[number];

/** Petal at `sway = 0`: an elongated ellipse approximation centred on the origin. */
function petalPath(seed: PetalSeed, size: number): string {
  const w = seed.petalW * size;
  const h = seed.petalH * size;
  return `M 0 ${-h} Q ${w} 0 0 ${h} Q ${-w} 0 0 ${-h} Z`;
}

const PETAL_SAMPLERS: readonly LayerSampler[] = PETAL_SEEDS.map((seed) => (t, size) => {
  // Fall from top to bottom with spiral sway
  const y = t * size * 1.1 - size * 0.05;
  const x = size * seed.xOff + Math.sin(t * Math.PI * 2 * seed.rotSpeed) * seed.spiralR * size;
  const sway = Math.sin(t * Math.PI * 4) * 0.5;
  const alpha = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 0.4;
  return { x, y, rotateDeg: 0, scaleX: 1 + sway, scaleY: 1, opacity: alpha };
});

function petalArt(seed: PetalSeed): StaticArt {
  const [cr, cg, cb] = PINK_SHADES[seed.ci]!;
  return (context, size) => {
    context
      .path(svgPath(petalPath(seed, size)))
      .fill(`rgb(${cr},${cg},${cb})`)
      .stroke({ color: `rgb(${cr - 20},${cg - 20},${cb - 20})`, width: PETAL_STROKE_WIDTH });
  };
}

const nodes = PETAL_SEEDS.map((seed, i): LayerNode => ({
  kind: 'layer',
  sample: PETAL_SAMPLERS[i]!,
  art: petalArt(seed),
  durationMs: LOOP_MS,
  phase: seed.phase,
}));

export const petalDanceFlair: DecorationSpec = { id: 'petalDance', nodes };

/**
 * Comet Tail: 3 comets orbit the periphery, each with 8 fading trail segments. Head, trail and
 * glow orbit as one rigid group under one pulse envelope, so each comet is art spun about the
 * tile centre by one layer. The seed phase offsets the pulse, not time.
 */
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 5000;
const COMET_COUNT = 3;
const TRAIL_LEN = 8;

const COMET_SEEDS = Array.from({ length: COMET_COUNT }, (_, i) => ({
  angle0: (i / COMET_COUNT) * Math.PI * 2,
  phase: i / COMET_COUNT,
  speed: 0.5 + i * 0.15,
}));

const TRAIL_INDICES = Array.from({ length: TRAIL_LEN + 1 }, (_, j) => j);

/** The group spins `speed` turns per loop; `pulse` is the envelope. */
const COMET_SAMPLERS: readonly LayerSampler[] = COMET_SEEDS.map((seed) => (t, size) => {
  const pulse = 0.5 + 0.5 * Math.sin((t * 4 + seed.phase * 6) * Math.PI);
  return {
    x: size / 2,
    y: size / 2,
    rotateDeg: t * seed.speed * 360,
    scaleX: 1,
    scaleY: 1,
    opacity: pulse,
  };
});

/** Comet drawn centred on the tile centre. */
const COMET_ARTS: readonly StaticArt[] = COMET_SEEDS.map((seed) => (context, size) => {
  const orbit = size * 0.4;
  for (const j of TRAIL_INDICES) {
    const ta = seed.angle0 - j * 0.12;
    const td = orbit + j * 1;
    const r = j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
    const alpha = j === 0 ? 0.85 : Math.max(0, 0.5 - j * 0.05);
    context
      .circle(Math.cos(ta) * td, Math.sin(ta) * td, r)
      .fill({ color: 'rgb(180,200,255)', alpha });
  }
  context
    .circle(Math.cos(seed.angle0) * orbit, Math.sin(seed.angle0) * orbit, size * 0.03)
    .fill({ color: 'rgb(220,235,255)', alpha: 0.3 });
});

const nodes = COMET_SEEDS.map((_, i): LayerNode => ({
  kind: 'layer',
  sample: COMET_SAMPLERS[i]!,
  art: COMET_ARTS[i]!,
  durationMs: LOOP_MS,
}));

export const cometTailFlair: DecorationSpec = { id: 'cometTail', nodes };

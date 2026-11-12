/** Frost Aura: 8 ice-blue flakes orbit the avatar, pulsing in size and opacity. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const N = 8;

const FROST_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  orbitFrac: 0.42 + (i % 3) * 0.05,
  rFrac: 0.015 + (i % 4) * 0.005,
  speed: 0.8 + (i % 3) * 0.2,
  index: i,
}));

const FROST_SAMPLERS: readonly DotSampler[] = FROST_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + t * Math.PI * 2 * seed.speed;
  const orbit = seed.orbitFrac * size;
  const x = cx + Math.cos(angle) * orbit;
  const y = cy + Math.sin(angle) * orbit;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4 + seed.index);
  const alpha = 0.3 + pulse * 0.4;
  const r = seed.rFrac * size * (0.8 + pulse * 0.4);
  return { cx: x, cy: y, r, opacity: alpha };
});

const nodes = FROST_SAMPLERS.map((sample): DecorationNode => ({
  kind: 'dot',
  sample,
  durationMs: LOOP_MS,
  color: 'rgb(140,220,255)',
}));

export const frostAuraFlair: DecorationSpec = { id: 'frostAura', nodes };

/**
 * RuneCircleFlair — Rune Circle
 *
 * 8 geometric runes (cross/diamond/triangle/square) arranged in a rotating ring,
 * halo layer + rune path layer + center point, with wave-pulse flow. Halo, glyph and centre point
 * share one orbit position and `pulse` envelope, so each rune is one LoopLayer whose children
 * carry the static per-element opacity weights.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 10000;
const N = 8;
const ORBIT = 0.42;
const GLYPH_R_FRAC = 0.04;
/** Layer box as a multiple of glyph radius; the halo reaches 1.6 × glyph radius. */
const BOX_FACTOR = 4;

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

/** `index` enters the orbit angle with the opposite sign to the pulse wave, so it stays in the sampler. */
const RUNE_SAMPLERS: readonly LayerSampler[] = RUNE_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const orbit = ORBIT * size;
  const angle = (seed.index / N) * Math.PI * 2 + t * Math.PI * 2;
  const x = cx + Math.cos(angle) * orbit;
  const y = cy + Math.sin(angle) * orbit;
  const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((t * N - seed.index) * Math.PI * 2) / N));
  return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: pulse };
});

/** Static rune artwork centred on the origin: halo disc, glyph outline, centre point. */
function RuneArt({ seed, size }: { seed: RuneSeed; size: number }) {
  const glyphR = size * GLYPH_R_FRAC;
  const box = glyphR * BOX_FACTOR;
  const half = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Circle r={glyphR * 1.6} fill="rgb(180,120,240)" opacity={0.2} />
      <Path
        d={buildGlyphD(seed.glyph, 0, 0, glyphR)}
        stroke="rgb(200,160,255)"
        fill="none"
        strokeWidth={1.5}
        opacity={0.85}
      />
      <Circle r={size * 0.006} fill="rgb(220,190,255)" opacity={0.7} />
    </Svg>
  );
}

export const RuneCircleFlair = memo<FlairProps>(({ size }) => {
  const cx = size / 2;
  const cy = size / 2;
  const orbit = ORBIT * size;
  const box = size * GLYPH_R_FRAC * BOX_FACTOR;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={orbit}
          fill="none"
          stroke="rgb(160,96,224)"
          strokeWidth={1}
          opacity={0.1}
        />
      </Svg>
      {RUNE_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`${seed.glyph}-${seed.index}`}
          sample={RUNE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          width={box}
          height={box}
        >
          <RuneArt seed={seed} size={size} />
        </LoopLayer>
      ))}
    </View>
  );
});
RuneCircleFlair.displayName = 'RuneCircleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

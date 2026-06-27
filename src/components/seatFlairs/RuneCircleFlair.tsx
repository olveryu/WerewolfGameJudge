/**
 * RuneCircleFlair — Rune Circle
 *
 * 8 geometric runes (cross/diamond/triangle/square) arranged in a rotating ring,
 * halo layer + rune path layer + center point, with wave-pulse flow.
 * react-native-svg + Reanimated useAnimatedProps.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { LegendaryAura } from './legendaryEffects';
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const N = 8;
const ORBIT = 0.42;

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

const buildGlyphD = (glyph: GlyphType, x: number, y: number, g: number): string => {
  'worklet';
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

const RuneParticle = memo<{
  index: number;
  glyph: GlyphType;
  size: number;
  progress: { value: number };
}>(({ index, glyph, size, progress }) => {
  const cx = size / 2;
  const cy = size / 2;
  const orbit = ORBIT * size;
  const glyphR = size * 0.04;

  const haloProps = useAnimatedProps(() => {
    'worklet';
    const angle = (index / N) * Math.PI * 2 + progress.value * Math.PI * 2;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const pulse =
      0.3 + 0.7 * Math.max(0, Math.sin(((progress.value * N - index) * Math.PI * 2) / N));
    return { cx: x, cy: y, r: glyphR * 1.6, opacity: pulse * 0.2 };
  });

  const glyphProps = useAnimatedProps(() => {
    'worklet';
    const angle = (index / N) * Math.PI * 2 + progress.value * Math.PI * 2;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const pulse =
      0.3 + 0.7 * Math.max(0, Math.sin(((progress.value * N - index) * Math.PI * 2) / N));
    const d = buildGlyphD(glyph, x, y, glyphR);
    return { d, opacity: pulse * 0.85, strokeWidth: 1.5 };
  });

  const dotProps = useAnimatedProps(() => {
    'worklet';
    const angle = (index / N) * Math.PI * 2 + progress.value * Math.PI * 2;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const pulse =
      0.3 + 0.7 * Math.max(0, Math.sin(((progress.value * N - index) * Math.PI * 2) / N));
    return { cx: x, cy: y, r: size * 0.006, opacity: pulse * 0.7 };
  });

  return (
    <>
      <AnimatedCircle animatedProps={haloProps} fill="rgb(180,120,240)" />
      <AnimatedPath animatedProps={glyphProps} stroke="rgb(200,160,255)" fill="none" />
      <AnimatedCircle animatedProps={dotProps} fill="rgb(220,190,255)" />
    </>
  );
});
RuneParticle.displayName = 'RuneParticle';

export const RuneCircleFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(10000);
  const slowProgress = useLoopProgress(7000);
  const cx = size / 2;
  const cy = size / 2;
  const orbit = ORBIT * size;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <LegendaryAura size={size} progress={slowProgress} r={160} g={96} b={224} orbit={ORBIT} />
        <Circle
          cx={cx}
          cy={cy}
          r={orbit}
          fill="none"
          stroke="rgb(160,96,224)"
          strokeWidth={1}
          opacity={0.1}
        />
        {GLYPH_ORDER.map((g, i) => (
          <RuneParticle key={i} index={i} glyph={g} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
RuneCircleFlair.displayName = 'RuneCircleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

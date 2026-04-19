/**
 * legendaryEffects — legendary-exclusive visual enhancements.
 *
 * Breathing center glow + hue-shifting orbit ring.
 * Renders behind particles to create multi-layer depth that epic flairs lack.
 */
import { memo } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';

import { AnimatedCircle } from './svgAnimatedPrimitives';

/**
 * LegendaryAura — two-layer background effect:
 *   1. Large semi-transparent center glow (breathing opacity 0.03–0.10)
 *   2. Thin orbit ring whose color temperature oscillates over time
 *
 * Place as first children inside `<Svg>` so particles render on top.
 */
export const LegendaryAura = memo<{
  size: number;
  progress: { value: number };
  r: number;
  g: number;
  b: number;
  orbit?: number;
}>(({ size, progress, r, g, b, orbit = 0.38 }) => {
  const cx = size / 2;
  const cy = size / 2;

  const glowProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    return { cx, cy, r: size * 0.35, opacity: breathe } as Record<string, number>;
  });

  const ringProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 + 1));
    const shift = Math.sin(t * Math.PI * 2) * 20;
    const nr = Math.max(0, Math.min(255, Math.round(r + shift)));
    const nb = Math.max(0, Math.min(255, Math.round(b - shift)));
    return {
      cx,
      cy,
      r: orbit * size,
      opacity: ringBreath,
      stroke: `rgb(${nr},${g},${nb})`,
      strokeWidth: size * 0.015,
    } as Record<string, number | string>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={glowProps} fill={`rgb(${r},${g},${b})`} />
      <AnimatedCircle animatedProps={ringProps} fill="none" />
    </>
  );
});
LegendaryAura.displayName = 'LegendaryAura';

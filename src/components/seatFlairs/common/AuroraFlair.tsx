/**
 * AuroraFlair — aurora
 *
 * Two ribbons along the top edge slowly bend and glow. Rare-tier seat flair template.
 *
 * The bend is a path-data morph, which CSS animations cannot interpolate, so each ribbon is
 * rendered as `RIBBON_VARIANTS` static curves cross-faded by `LoopMorph`.
 */
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LoopMorph, type MorphSampler } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 6000;
/** Static curves per ribbon; 8 across a 6 s loop keeps each cross-fade under a second. */
const RIBBON_VARIANTS = 8;

function arc1Path(t: number, size: number): string {
  const w = size;
  const yBase = size * 0.12;
  const amp = size * 0.06;
  const cp1y = yBase + Math.sin(t * Math.PI * 2) * amp;
  const cp2y = yBase + Math.sin(t * Math.PI * 2 + 1.5) * amp;
  return `M 0 ${yBase} C ${w * 0.3} ${cp1y}, ${w * 0.7} ${cp2y}, ${w} ${yBase}`;
}

function arc2Path(t: number, size: number): string {
  const w = size;
  const yBase = size * 0.16;
  const amp = size * 0.04;
  const cp1y = yBase + Math.sin(t * Math.PI * 2 + Math.PI) * amp;
  const cp2y = yBase + Math.sin(t * Math.PI * 2 + Math.PI + 1.2) * amp;
  return `M 0 ${yBase} C ${w * 0.25} ${cp1y}, ${w * 0.75} ${cp2y}, ${w} ${yBase}`;
}

const arc1Sampler: MorphSampler = (t) => ({ opacity: 0.35 + Math.sin(t * Math.PI * 2) * 0.1 });
const arc2Sampler: MorphSampler = (t) => ({ opacity: 0.2 + Math.sin(t * Math.PI * 2 + 1) * 0.1 });

export const AuroraFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const renderArc1 = useCallback(
    (k: number, s: number) => (
      <Svg width={s} height={s}>
        <Path
          d={arc1Path(k / RIBBON_VARIANTS, s)}
          fill="none"
          stroke={colors.rgb}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    ),
    [colors.rgb],
  );
  const renderArc2 = useCallback(
    (k: number, s: number) => (
      <Svg width={s} height={s}>
        <Path
          d={arc2Path(k / RIBBON_VARIANTS, s)}
          fill="none"
          stroke={colors.rgbLight}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Svg>
    ),
    [colors.rgbLight],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <LoopMorph
        sample={arc1Sampler}
        size={size}
        durationMs={LOOP_MS}
        variantCount={RIBBON_VARIANTS}
        mode="crossfade"
        renderVariant={renderArc1}
      />
      <LoopMorph
        sample={arc2Sampler}
        size={size}
        durationMs={LOOP_MS}
        variantCount={RIBBON_VARIANTS}
        mode="crossfade"
        renderVariant={renderArc2}
      />
    </View>
  );
});
AuroraFlair.displayName = 'AuroraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});

/**
 * Silver-feathered raven companion for fateDecree. Visual-only, with one cancellable wing loop.
 * The wing + flight-feather lift is a path morph rendered as cross-faded static variants by one
 * LoopMorph; everything else is static artwork.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LoopMorph, type MorphSampler } from '@/components/loopMotion';
import { MYTHIC_COLORS } from '@/config/mythicVisual';

import type { PetProps } from './PetProps';

const LOOP_MS = 4200;
/** Static wing poses per 4.2 s beat; 8 keeps each cross-fade near half a second. */
const WING_VARIANTS = 8;
/** This pet is authored in a 100 × 100 viewBox. */
const RAVEN_VIEWBOX_ATTR = '0 0 100 100';

function wingPath(t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 6;
  return `M53 45 Q32 ${27 - lift} 9 ${21 - lift} L16 ${39 - lift} L22 ${35 - lift} L23 ${48 - lift} L30 ${43 - lift} L33 ${57 - lift} Q45 68 58 57 Z`;
}

function featherPath(t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 6;
  return `M19 ${31 - lift} L45 52 M27 ${36 - lift} L48 55 M35 ${41 - lift} L51 57`;
}

const wingSampler: MorphSampler = () => ({ opacity: 1 });

const renderWing = (k: number, s: number) => (
  <Svg width={s} height={s} viewBox={RAVEN_VIEWBOX_ATTR}>
    <Path
      d={wingPath(k / WING_VARIANTS)}
      fill={MYTHIC_COLORS.silver}
      stroke={MYTHIC_COLORS.obsidian}
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <Path
      d={featherPath(k / WING_VARIANTS)}
      stroke={MYTHIC_COLORS.metal}
      strokeWidth={2}
      fill="none"
    />
  </Svg>
);

/** Renders a red-eyed raven with gently moving silver flight feathers. */
export const NightRavenPet = memo<PetProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox={RAVEN_VIEWBOX_ATTR}>
      <Path
        d="M47 65 L29 87 L41 82 L43 89 L59 69 Z"
        fill={MYTHIC_COLORS.metal}
        stroke={MYTHIC_COLORS.obsidian}
        strokeWidth={2}
      />
      <Path
        d="M53 42 Q65 36 72 50 Q75 65 60 73 Q47 77 40 65 Q37 52 53 42 Z"
        fill={MYTHIC_COLORS.obsidian}
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={2}
      />
    </Svg>
    <LoopMorph
      sample={wingSampler}
      size={size}
      durationMs={LOOP_MS}
      variantCount={WING_VARIANTS}
      mode="stacked"
      renderVariant={renderWing}
    />
    <Svg width={size} height={size} viewBox={RAVEN_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      <Path
        d="M55 43 Q52 27 63 23 Q77 20 81 34 L77 49 L67 57 L59 51 Z"
        fill={MYTHIC_COLORS.obsidian}
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={2}
      />
      <Path
        d="M79 33 L95 41 L78 43 Z"
        fill={MYTHIC_COLORS.metal}
        stroke={MYTHIC_COLORS.obsidian}
        strokeWidth={2}
      />
      <Path
        d="M60 29 Q66 25 73 28 M61 48 L65 54 L69 49 M54 71 L54 79 L48 81 M65 69 L66 77 L72 79"
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={73} cy={34} r={3.5} fill={MYTHIC_COLORS.crimson} />
      <Circle cx={74} cy={33} r={1} fill={MYTHIC_COLORS.highlight} />
    </Svg>
  </View>
));
NightRavenPet.displayName = 'NightRavenPet';

const styles = StyleSheet.create({
  wrapper: { pointerEvents: 'none' },
});

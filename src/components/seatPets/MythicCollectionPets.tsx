/**
 * Reveal companions with distinct silhouettes, confined to the seat's existing pet viewport.
 * The whole-pet bob is a LoopLayer translating a size × size box; the astral orbit is a static
 * ellipse + pearl rotated by a nested LoopLayer; ocean / ink wings are path morphs rendered as
 * cross-faded static variants by a LoopMorph.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import {
  type LayerSampler,
  LoopLayer,
  LoopMorph,
  type MorphSampler,
} from '@/components/loopMotion';
import { MYTHIC_COLLECTION_COLORS, type MythicCollection } from '@/config/mythicVisual';

import type { PetProps } from './PetProps';

const LOOP_MS = 4200;
/** Static wing poses per 4.2 s beat; 8 keeps each cross-fade near half a second. */
const WING_VARIANTS = 8;
/** These pets are authored in a 100 × 100 viewBox. */
const MYTHIC_VIEWBOX = 100;
const MYTHIC_VIEWBOX_ATTR = `0 0 ${MYTHIC_VIEWBOX} ${MYTHIC_VIEWBOX}`;

/** Orbit ellipse (ry 39, stroke 2.5) and pearl (cy 9, r 4) reach ≤ 43 from the pivot; box 90 contains them. */
const ORBIT_BOX_UNITS = 90;
const ORBIT = { cx: 50, cy: 48 } as const;

/** Converts a 100-unit viewBox coordinate to px for a pet rendered at `size`. */
function mythicUnitsToPx(units: number, size: number): number {
  return (units * size) / MYTHIC_VIEWBOX;
}

// Whole-pet bob — translate(0, sin(t·2π)·4)
const floatSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 + mythicUnitsToPx(Math.sin(t * Math.PI * 2) * 4, size),
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

// Astral orbit — rotate(t·360) about (50, 48)
const orbitSampler: LayerSampler = (t, size) => ({
  x: mythicUnitsToPx(ORBIT.cx, size),
  y: mythicUnitsToPx(ORBIT.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function wingPath(collection: MythicCollection, t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 17;
  return collection === 'ocean'
    ? `M50 34 L34 39 L8 ${23 + lift} Q11 66 34 65 L50 74 L66 65 Q89 66 92 ${23 + lift} L66 39 Z`
    : `M49 60 L8 ${17 + lift} L31 70 L49 75 L91 ${16 - lift} L69 62 Z`;
}

const wingSampler: MorphSampler = () => ({ opacity: 1 });

const renderOceanWing = (k: number, s: number) => (
  <Svg width={s} height={s} viewBox={MYTHIC_VIEWBOX_ATTR}>
    <Path
      d={wingPath('ocean', k / WING_VARIANTS)}
      fill={MYTHIC_COLLECTION_COLORS.ocean.primary}
      stroke={MYTHIC_COLLECTION_COLORS.ocean.dark}
      strokeWidth={2}
    />
  </Svg>
);

const renderInkWing = (k: number, s: number) => (
  <Svg width={s} height={s} viewBox={MYTHIC_VIEWBOX_ATTR}>
    <Path
      d={wingPath('ink', k / WING_VARIANTS)}
      fill={MYTHIC_COLLECTION_COLORS.ink.pearl}
      stroke={MYTHIC_COLLECTION_COLORS.ink.dark}
      strokeWidth={2}
    />
  </Svg>
);

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

function CollectionPet({ size, collection }: PetProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const orbitBox = mythicUnitsToPx(ORBIT_BOX_UNITS, size);
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <LoopLayer sample={floatSampler} size={size} durationMs={LOOP_MS} width={size} height={size}>
        {collection === 'astral' ? (
          <>
            <Svg width={size} height={size} viewBox={MYTHIC_VIEWBOX_ATTR}>
              <Ellipse
                cx={50}
                cy={48}
                rx={39}
                ry={19}
                fill="none"
                stroke={colors.secondary}
                strokeWidth={3}
              />
            </Svg>
            <LoopLayer
              sample={orbitSampler}
              size={size}
              durationMs={LOOP_MS}
              width={orbitBox}
              height={orbitBox}
            >
              <Svg
                width={orbitBox}
                height={orbitBox}
                viewBox={centredViewBox(ORBIT, ORBIT_BOX_UNITS)}
              >
                <Ellipse
                  cx={50}
                  cy={48}
                  rx={18}
                  ry={39}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                />
                <Circle cx={50} cy={9} r={4} fill={colors.pearl} />
              </Svg>
            </LoopLayer>
            <Svg
              width={size}
              height={size}
              viewBox={MYTHIC_VIEWBOX_ATTR}
              style={StyleSheet.absoluteFill}
            >
              <Path
                d="M50 9 L67 47 L50 88 L33 47 Z"
                fill={colors.dark}
                stroke={colors.secondary}
                strokeWidth={3}
              />
              <Path
                d="M50 26 L54 43 L65 48 L54 52 L50 69 L46 52 L35 48 L46 43 Z"
                fill={colors.pearl}
              />
            </Svg>
          </>
        ) : collection === 'ocean' ? (
          <>
            <Svg width={size} height={size} viewBox={MYTHIC_VIEWBOX_ATTR}>
              <Path d="M50 64 Q82 86 55 94" fill="none" stroke={colors.secondary} strokeWidth={3} />
            </Svg>
            <LoopMorph
              sample={wingSampler}
              size={size}
              durationMs={LOOP_MS}
              variantCount={WING_VARIANTS}
              mode="crossfade"
              renderVariant={renderOceanWing}
            />
            <Svg
              width={size}
              height={size}
              viewBox={MYTHIC_VIEWBOX_ATTR}
              style={StyleSheet.absoluteFill}
            >
              <Path d="M50 38 L31 59 Q50 78 69 59 Z" fill={colors.pearl} />
              <G fill={colors.dark}>
                <Circle cx={42} cy={49} r={3} />
                <Circle cx={58} cy={49} r={3} />
              </G>
              <Circle
                cx={50}
                cy={29}
                r={6}
                fill={colors.pearl}
                stroke={colors.secondary}
                strokeWidth={2}
              />
            </Svg>
          </>
        ) : (
          <>
            <LoopMorph
              sample={wingSampler}
              size={size}
              durationMs={LOOP_MS}
              variantCount={WING_VARIANTS}
              mode="crossfade"
              renderVariant={renderInkWing}
            />
            <Svg
              width={size}
              height={size}
              viewBox={MYTHIC_VIEWBOX_ATTR}
              style={StyleSheet.absoluteFill}
            >
              <Path
                d="M45 66 L57 28 L65 24 L82 35 L67 34 L58 73 Z"
                fill={colors.dark}
                stroke={colors.primary}
                strokeWidth={2}
              />
              <Path
                d="M58 27 L66 24 L71 28 L64 31 Z M46 73 L42 84 L53 81"
                fill={colors.secondary}
                stroke={colors.secondary}
                strokeWidth={2}
              />
              <Circle cx={65} cy={30} r={1.5} fill={colors.pearl} />
            </Svg>
          </>
        )}
      </LoopLayer>
    </View>
  );
}

/** Celestial shuttle bundled with the fate reweaving reveal. */
export const StarShuttlePet = memo<PetProps>((props) => (
  <CollectionPet {...props} collection="astral" />
));
/** Pearl-bearing ray bundled with the ocean reveal. */
export const PearlRayPet = memo<PetProps>((props) => (
  <CollectionPet {...props} collection="ocean" />
));
/** Folding paper crane bundled with the landscape reveal. */
export const PaintedCranePet = memo<PetProps>((props) => (
  <CollectionPet {...props} collection="ink" />
));
StarShuttlePet.displayName = 'StarShuttlePet';
PearlRayPet.displayName = 'PearlRayPet';
PaintedCranePet.displayName = 'PaintedCranePet';

const styles = StyleSheet.create({
  wrapper: { pointerEvents: 'none' },
});

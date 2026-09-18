/** Reveal companions with distinct silhouettes, confined to the seat's existing pet viewport. */
import { memo } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { MYTHIC_COLLECTION_COLORS, type MythicCollection } from '@/config/mythicVisual';

import { AnimatedG, AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import { type PetProps, useLoop } from './PetProps';

function CollectionPet({ size, collection }: PetProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const progress = useLoop(4200);
  const orbit = useAnimatedProps(() => ({ transform: `rotate(${progress.value * 360} 50 48)` }));
  const float = useAnimatedProps(() => ({
    transform: `translate(0 ${Math.sin(progress.value * Math.PI * 2) * 4})`,
  }));
  const wings = useAnimatedProps(() => {
    const lift = Math.sin(progress.value * Math.PI * 2) * 17;
    return {
      d:
        collection === 'ocean'
          ? `M50 34 L34 39 L8 ${23 + lift} Q11 66 34 65 L50 74 L66 65 Q89 66 92 ${23 + lift} L66 39 Z`
          : `M49 60 L8 ${17 + lift} L31 70 L49 75 L91 ${16 - lift} L69 62 Z`,
    };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <AnimatedG animatedProps={float}>
        {collection === 'astral' ? (
          <>
            <Ellipse
              cx={50}
              cy={48}
              rx={39}
              ry={19}
              fill="none"
              stroke={colors.secondary}
              strokeWidth={3}
            />
            <AnimatedG animatedProps={orbit}>
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
            </AnimatedG>
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
          </>
        ) : collection === 'ocean' ? (
          <>
            <Path d="M50 64 Q82 86 55 94" fill="none" stroke={colors.secondary} strokeWidth={3} />
            <AnimatedPath
              animatedProps={wings}
              fill={colors.primary}
              stroke={colors.dark}
              strokeWidth={2}
            />
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
          </>
        ) : (
          <>
            <AnimatedPath
              animatedProps={wings}
              fill={colors.pearl}
              stroke={colors.dark}
              strokeWidth={2}
            />
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
          </>
        )}
      </AnimatedG>
    </Svg>
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

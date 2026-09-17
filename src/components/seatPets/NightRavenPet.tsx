/** Silver-feathered raven companion for fateDecree. Visual-only, with one cancellable wing loop. */
import { memo } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { MYTHIC_COLORS } from '@/config/mythicVisual';

import { AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import { type PetProps, useLoop } from './PetProps';

/** Renders a red-eyed raven with gently moving silver flight feathers. */
export const NightRavenPet = memo<PetProps>(({ size }) => {
  const progress = useLoop(4200);
  const wingProps = useAnimatedProps(() => {
    const lift = Math.sin(progress.value * Math.PI * 2) * 6;
    return {
      d: `M53 45 Q32 ${27 - lift} 9 ${21 - lift} L16 ${39 - lift} L22 ${35 - lift} L23 ${48 - lift} L30 ${43 - lift} L33 ${57 - lift} Q45 68 58 57 Z`,
    };
  });
  const featherProps = useAnimatedProps(() => {
    const lift = Math.sin(progress.value * Math.PI * 2) * 6;
    return { d: `M19 ${31 - lift} L45 52 M27 ${36 - lift} L48 55 M35 ${41 - lift} L51 57` };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
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
      <AnimatedPath
        animatedProps={wingProps}
        fill={MYTHIC_COLORS.silver}
        stroke={MYTHIC_COLORS.obsidian}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <AnimatedPath
        animatedProps={featherProps}
        stroke={MYTHIC_COLORS.metal}
        strokeWidth={2}
        fill="none"
      />
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
  );
});
NightRavenPet.displayName = 'NightRavenPet';

/** Bottom-left collection scenery; leaves the face and bottom-right companion unobstructed. */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedG, AnimatedPath } from './svgAnimatedPrimitives';

function CollectionFlair({ size, collection }: FlairProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const weave = useAnimatedProps(() => ({ transform: `rotate(${progress.value * 360})` }));
  const flow = useAnimatedProps(() => ({ strokeDashoffset: -progress.value * 180 }));
  const tide = useAnimatedProps(() => ({
    d: `M5 88 Q17 ${77 + Math.sin(progress.value * Math.PI * 2) * 7} 30 86 T62 86 M7 94 Q25 ${83 - Math.sin(progress.value * Math.PI * 2) * 5} 39 92 T66 90`,
  }));
  const stars = useAnimatedProps(() => ({
    transform: `translate(0 ${-progress.value * 12})`,
    opacity: Math.sin(progress.value * Math.PI),
  }));
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {collection === 'astral' ? (
        <>
          <G transform="translate(34 88) scale(1 .24)">
            <AnimatedG animatedProps={weave}>
              <Path
                d="M-26 -26 H26 V26 H-26 Z M-13 -26 V26 M0 -26 V26 M13 -26 V26 M-26 -13 H26 M-26 0 H26 M-26 13 H26"
                fill="none"
                stroke={colors.primary}
                strokeWidth={1.5}
              />
              <Path
                d="M0 -34 L34 0 L0 34 L-34 0 Z"
                fill="none"
                stroke={colors.secondary}
                strokeWidth={2}
              />
            </AnimatedG>
          </G>
          <AnimatedG animatedProps={stars}>
            <Path
              d="M15 79 v-7 m-3 3 h6 M34 85 v-9 m-4 4 h8 M54 78 v-6 m-3 3 h6"
              stroke={colors.pearl}
              strokeWidth={1.2}
            />
          </AnimatedG>
        </>
      ) : collection === 'ocean' ? (
        <>
          <AnimatedPath
            animatedProps={tide}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.3}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={flow}
            d="M5 91 Q20 80 35 89 T66 89"
            fill="none"
            stroke={colors.pearl}
            strokeWidth={1.3}
            strokeDasharray="5 9"
          />
          <AnimatedG animatedProps={stars}>
            <Path
              d="M16 83 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 M46 89 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6"
              fill="none"
              stroke={colors.secondary}
            />
          </AnimatedG>
        </>
      ) : (
        <>
          <Path
            d="M4 92 L16 76 L24 85 L38 69 L48 85 L58 78 L68 93 Z"
            fill={colors.dark}
            opacity={0.8}
          />
          <Path d="M9 92 L21 83 L29 89 L40 79 L54 93 Z" fill={colors.primary} />
          <Path d="M33 78 L38 69 L43 78 M11 83 L16 76 L20 82" fill="none" stroke={colors.pearl} />
          <AnimatedPath
            animatedProps={flow}
            d="M15 94 Q24 88 35 93 T63 94"
            fill="none"
            stroke={colors.pearl}
            strokeWidth={1.6}
            strokeDasharray="14 9"
          />
          <AnimatedG animatedProps={stars}>
            <Path d="M15 76 l4 -2 l-2 5 Z M51 82 l5 -3 l-2 5 Z" fill={colors.secondary} />
          </AnimatedG>
        </>
      )}
    </Svg>
  );
}

/** Weaves a low-perspective star grid beneath the avatar. */
export const StarWeaveFlair = memo<FlairProps>((props) => (
  <CollectionFlair {...props} collection="astral" />
));
/** Receding waves and coral-colored bubbles. */
export const MoonTidesFlair = memo<FlairProps>((props) => (
  <CollectionFlair {...props} collection="ocean" />
));
/** Layered ink mountains with a moving river highlight. */
export const PaintedMountainsFlair = memo<FlairProps>((props) => (
  <CollectionFlair {...props} collection="ink" />
));
StarWeaveFlair.displayName = 'StarWeaveFlair';
MoonTidesFlair.displayName = 'MoonTidesFlair';
PaintedMountainsFlair.displayName = 'PaintedMountainsFlair';

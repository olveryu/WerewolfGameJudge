/** Square mythic frames: stationary avatar boundary with collection-owned moving ornaments. */
import { memo, useId } from 'react';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

import { AnimatedG, AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import type { FrameProps } from './FrameProps';

function CollectionFrame({ size, rx, collection }: FrameProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const gradientId = useId();
  const progress = useLoopProgress(MYTHIC_LOOP_DURATION);
  const mechanism = useAnimatedProps(() => ({ transform: `rotate(${progress.value * 360} 50 0)` }));
  const current = useAnimatedProps(() => ({ strokeDashoffset: -progress.value * 400 }));
  const shimmer = useAnimatedProps(() => ({
    opacity: 0.25 + Math.sin(progress.value * Math.PI * 2) ** 2 * 0.75,
  }));
  const wave = useAnimatedProps(() => ({
    transform: `translate(${Math.sin(progress.value * Math.PI * 2) * 3} 0)`,
  }));
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.pearl} />
          <Stop offset=".25" stopColor={colors.secondary} />
          <Stop offset=".5" stopColor={colors.dark} />
          <Stop offset=".75" stopColor={colors.pearl} />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} rx={rx} fill="none" stroke={colors.dark} strokeWidth={5} />
      <Rect
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3}
      />
      <Rect
        x={3}
        y={3}
        width={94}
        height={94}
        rx={Math.max(0, rx - 3)}
        fill="none"
        stroke={colors.primary}
        strokeWidth={0.6}
      />
      {[0, 90, 180, 270].map((rotation) => (
        <G key={rotation} rotation={rotation} origin="50, 50">
          {collection === 'astral' ? (
            <>
              <Path
                d="M17 0 L24 -5 H76 L83 0 L67 -1 H33 Z"
                fill={colors.dark}
                stroke={colors.secondary}
              />
              <Path d="M28 -2 V-5 M36 -2 V-5 M64 -2 V-5 M72 -2 V-5" stroke={colors.primary} />
              <AnimatedG animatedProps={mechanism}>
                <Path
                  d="M50 -7 V7 M43 0 H57 M45 -5 L55 5 M45 5 L55 -5"
                  stroke={colors.secondary}
                  strokeWidth={1.5}
                />
                <Circle cx={50} cy={0} r={3} fill={colors.pearl} />
              </AnimatedG>
            </>
          ) : collection === 'ocean' ? (
            <>
              <Path
                d="M20 1 L24 -3 L22 -7 M24 -3 L30 -5 M38 1 L40 -4 L37 -6 M40 -4 L45 -7 M63 1 L67 -4 L65 -7 M67 -4 L72 -6 M79 1 L81 -3 L79 -7"
                fill="none"
                stroke={colors.secondary}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <AnimatedG animatedProps={wave}>
                <Path
                  d="M17 -1 Q27 -7 37 -2 T57 -2 T77 -2"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={1.5}
                />
              </AnimatedG>
            </>
          ) : (
            <>
              <Path d="M14 1 L26 -5 L54 -3 L83 -6 L75 1 L44 -1 Z" fill={colors.dark} />
              <AnimatedPath
                animatedProps={current}
                d="M18 -1 L40 -3 L80 -4 M23 -3 L47 -1 L76 -5"
                fill="none"
                stroke={colors.pearl}
                strokeWidth={0.8}
                strokeDasharray="14 9"
              />
              <Path
                d="M44 -6 H55 V5 H44 Z M47 -3 V2 H52 V-3 Z"
                fill={colors.secondary}
                fillRule="evenodd"
              />
            </>
          )}
        </G>
      ))}
      {[
        [7, 7],
        [93, 7],
        [7, 93],
        [93, 93],
      ].map(([horizontal, vertical]) => (
        <G key={`${horizontal}-${vertical}`} transform={`translate(${horizontal} ${vertical})`}>
          {collection === 'ocean' ? (
            <>
              <Circle r={5.5} fill={colors.dark} stroke={colors.secondary} />
              <Circle r={3.8} fill={`url(#${gradientId})`} />
            </>
          ) : collection === 'astral' ? (
            <Path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill={colors.dark} stroke={colors.secondary} />
          ) : (
            <Path
              d="M-5 4 V-5 H4 M1 -2 V3 H5"
              fill="none"
              stroke={colors.pearl}
              strokeWidth={1.6}
            />
          )}
          <AnimatedG animatedProps={shimmer}>
            <Path d="M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1 Z" fill={colors.primary} />
          </AnimatedG>
        </G>
      ))}
      <AnimatedPath
        animatedProps={current}
        d={`M50 0 H${100 - rx} Q100 0 100 ${rx} V${100 - rx} Q100 100 ${100 - rx} 100 H${rx} Q0 100 0 ${100 - rx} V${rx} Q0 0 ${rx} 0 Z`}
        fill="none"
        stroke={colors.pearl}
        strokeWidth={1.5}
        strokeDasharray="24 176"
      />
    </Svg>
  );
}

/** Gold star mechanisms assembled around a fixed square aperture. */
export const CelestialLoomFrame = memo<FrameProps>((props) => (
  <CollectionFrame {...props} collection="astral" />
));
/** Coral and nacre frame with traveling tidal light. */
export const CoralTideFrame = memo<FrameProps>((props) => (
  <CollectionFrame {...props} collection="ocean" />
));
/** Jade and ink frame with moving dry-brush highlights. */
export const InkLandscapeFrame = memo<FrameProps>((props) => (
  <CollectionFrame {...props} collection="ink" />
));
CelestialLoomFrame.displayName = 'CelestialLoomFrame';
CoralTideFrame.displayName = 'CoralTideFrame';
InkLandscapeFrame.displayName = 'InkLandscapeFrame';

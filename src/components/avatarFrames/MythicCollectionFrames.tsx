/** Mythic collection frames; artwork stays inside the shared eight-unit overflow contract. */
import { memo, useCallback, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { type LayerSampler, LoopDashFlow, LoopLayer } from '@/components/loopMotion';
import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';

import type { FrameProps } from './FrameProps';
import { FRAME_VIEWBOX, frameUnitsToPx } from './frameViewBox';
import { PerimeterSweep, type SweepSampler } from './PerimeterSweep';

/** The four edge groups are the top-edge artwork rotated about the frame centre. */
const EDGE_ROTATIONS = [0, 90, 180, 270] as const;
const CORNERS = [
  [7, 7],
  [93, 7],
  [7, 93],
  [93, 93],
] as const;

const CURRENT_DASH = 14;
const CURRENT_GAP = 9;
const CURRENT_TRAVEL = 400;
const PERIMETER_DASH = 24;
const PERIMETER_GAP = 176;
const PERIMETER_TRAVEL = 400;

/** Top-edge mechanism centre `(50, 0)` rotated about `(50, 50)` for each edge. */
const MECHANISM_CENTRES: readonly { x: number; y: number }[] = [
  { x: 50, y: 0 },
  { x: 100, y: 50 },
  { x: 50, y: 100 },
  { x: 0, y: 50 },
];
/** Mechanism artwork spans ±7 units plus stroke. */
const MECHANISM_BOX = 18;

/** Unit vector of the top edge's +x direction after each edge rotation. */
const WAVE_DIRECTIONS: readonly { x: number; y: number }[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

const MECHANISM_SAMPLERS: readonly LayerSampler[] = MECHANISM_CENTRES.map(
  (centre) => (t, size) => ({
    x: frameUnitsToPx(centre.x, size),
    y: frameUnitsToPx(centre.y, size),
    rotateDeg: t * 360,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  }),
);

const WAVE_SAMPLERS: readonly LayerSampler[] = WAVE_DIRECTIONS.map((dir) => (t, size) => {
  const shift = frameUnitsToPx(Math.sin(t * Math.PI * 2) * 3, size) - frameUnitsToPx(0, size);
  return {
    x: size / 2 + dir.x * shift,
    y: size / 2 + dir.y * shift,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
});

const shimmerSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 0.25 + Math.sin(t * Math.PI * 2) ** 2 * 0.75,
});

const perimeterCurrentSampler: SweepSampler = (t) => ({
  arcLength: t * PERIMETER_TRAVEL + PERIMETER_DASH,
  opacity: 1,
});

function CollectionFrame({ size, rx, collection }: FrameProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const gradientId = useId();
  const cornerGradientId = useId();
  const mechanismBoxPx = frameUnitsToPx(MECHANISM_BOX, size) - frameUnitsToPx(0, size);

  const renderCurrent = useCallback(
    (dashOffset: number, s: number) => (
      <Svg width={s} height={s} viewBox={FRAME_VIEWBOX}>
        {EDGE_ROTATIONS.map((rotation) => (
          <G key={rotation} rotation={rotation} origin="50, 50">
            <Path
              d="M18 -1 L40 -3 L80 -4 M23 -3 L47 -1 L76 -5"
              fill="none"
              stroke={colors.pearl}
              strokeWidth={0.8}
              strokeDasharray={`${CURRENT_DASH} ${CURRENT_GAP}`}
              strokeDashoffset={dashOffset}
            />
          </G>
        ))}
      </Svg>
    ),
    [colors.pearl],
  );

  const gradient = (id: string) => (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.pearl} />
        <Stop offset=".25" stopColor={colors.secondary} />
        <Stop offset=".5" stopColor={colors.dark} />
        <Stop offset=".75" stopColor={colors.pearl} />
        <Stop offset="1" stopColor={colors.primary} />
      </LinearGradient>
    </Defs>
  );

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
        {gradient(gradientId)}
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
        {EDGE_ROTATIONS.map((rotation) => (
          <G key={rotation} rotation={rotation} origin="50, 50">
            {collection === 'astral' ? (
              <>
                <Path
                  d="M17 0 L24 -5 H76 L83 0 L67 -1 H33 Z"
                  fill={colors.dark}
                  stroke={colors.secondary}
                />
                <Path d="M28 -2 V-5 M36 -2 V-5 M64 -2 V-5 M72 -2 V-5" stroke={colors.primary} />
              </>
            ) : collection === 'ocean' ? (
              <Path
                d="M20 1 L24 -3 L22 -7 M24 -3 L30 -5 M38 1 L40 -4 L37 -6 M40 -4 L45 -7 M63 1 L67 -4 L65 -7 M67 -4 L72 -6 M79 1 L81 -3 L79 -7"
                fill="none"
                stroke={colors.secondary}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            ) : (
              <Path d="M14 1 L26 -5 L54 -3 L83 -6 L75 1 L44 -1 Z" fill={colors.dark} />
            )}
          </G>
        ))}
      </Svg>

      {collection === 'astral' &&
        MECHANISM_CENTRES.map((centre, i) => (
          <LoopLayer
            key={`${centre.x}-${centre.y}`}
            sample={MECHANISM_SAMPLERS[i]!}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            width={mechanismBoxPx}
            height={mechanismBoxPx}
          >
            <Svg
              width={mechanismBoxPx}
              height={mechanismBoxPx}
              viewBox={`${-MECHANISM_BOX / 2} ${-MECHANISM_BOX / 2} ${MECHANISM_BOX} ${MECHANISM_BOX}`}
            >
              <Path
                d="M0 -7 V7 M-7 0 H7 M-5 -5 L5 5 M-5 5 L5 -5"
                stroke={colors.secondary}
                strokeWidth={1.5}
              />
              <Circle cx={0} cy={0} r={3} fill={colors.pearl} />
            </Svg>
          </LoopLayer>
        ))}

      {collection === 'ocean' &&
        EDGE_ROTATIONS.map((rotation, i) => (
          <LoopLayer
            key={rotation}
            sample={WAVE_SAMPLERS[i]!}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            width={size}
            height={size}
          >
            <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
              <G rotation={rotation} origin="50, 50">
                <Path
                  d="M17 -1 Q27 -7 37 -2 T57 -2 T77 -2"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={1.5}
                />
              </G>
            </Svg>
          </LoopLayer>
        ))}

      {collection === 'ink' && (
        <>
          <LoopDashFlow
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            dashPeriod={CURRENT_DASH + CURRENT_GAP}
            travel={CURRENT_TRAVEL}
            renderDashes={renderCurrent}
          />
          <Svg width={size} height={size} viewBox={FRAME_VIEWBOX} style={StyleSheet.absoluteFill}>
            {EDGE_ROTATIONS.map((rotation) => (
              <G key={rotation} rotation={rotation} origin="50, 50">
                <Path
                  d="M44 -6 H55 V5 H44 Z M47 -3 V2 H52 V-3 Z"
                  fill={colors.secondary}
                  fillRule="evenodd"
                />
              </G>
            ))}
          </Svg>
        </>
      )}

      <Svg width={size} height={size} viewBox={FRAME_VIEWBOX} style={StyleSheet.absoluteFill}>
        {gradient(cornerGradientId)}
        {CORNERS.map(([horizontal, vertical]) => (
          <G key={`${horizontal}-${vertical}`} transform={`translate(${horizontal} ${vertical})`}>
            {collection === 'ocean' ? (
              <>
                <Circle r={5.5} fill={colors.dark} stroke={colors.secondary} />
                <Circle r={3.8} fill={`url(#${cornerGradientId})`} />
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
          </G>
        ))}
      </Svg>
      <LoopLayer
        sample={shimmerSampler}
        size={size}
        durationMs={MYTHIC_LOOP_DURATION}
        width={size}
        height={size}
      >
        <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
          {CORNERS.map(([horizontal, vertical]) => (
            <Path
              key={`${horizontal}-${vertical}`}
              d="M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1 Z"
              fill={colors.primary}
              transform={`translate(${horizontal} ${vertical})`}
            />
          ))}
        </Svg>
      </LoopLayer>
      <PerimeterSweep
        size={size}
        rx={rx}
        durationMs={MYTHIC_LOOP_DURATION}
        sample={perimeterCurrentSampler}
        dashLength={PERIMETER_DASH}
        dashCount={2}
        dashSpacing={PERIMETER_DASH + PERIMETER_GAP}
        color={colors.pearl}
        strokeWidth={1.5}
      />
    </View>
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

const styles = StyleSheet.create({
  frame: { overflow: 'visible' },
});

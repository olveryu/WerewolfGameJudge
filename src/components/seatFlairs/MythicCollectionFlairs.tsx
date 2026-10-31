/** Bottom-left collection scenery; leaves the face and bottom-right companion unobstructed. */
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type LayerSampler,
  LoopDashFlow,
  LoopLayer,
  LoopMorph,
  type MorphSampler,
} from '@/components/loopMotion';
import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';

import type { FlairProps } from './FlairProps';

/** Artwork is authored in a 100 × 100 viewBox. */
const VIEWBOX = 100;

// ── Astral weave: rotating grid seen in floor perspective ─────────────────────
const WEAVE_CX = 34;
const WEAVE_CY = 88;
const WEAVE_SQUASH = 0.24;
/** Grid + diamond reach ±34 units plus stroke. */
const WEAVE_BOX = 74;

const weaveSampler: LayerSampler = (t, size) => {
  const box = (WEAVE_BOX / VIEWBOX) * size;
  return { x: box / 2, y: box / 2, rotateDeg: t * 360, scaleX: 1, scaleY: 1, opacity: 1 };
};

// ── Stars / bubbles / leaves: rise 12 units and fade over the loop ────────────
const STARS_RISE = 12;

const starsSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 - (t * STARS_RISE * size) / VIEWBOX,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: Math.sin(t * Math.PI),
});

// ── Ocean tide: control points bob ±7 / ∓5 units ──────────────────────────────
const TIDE_VARIANTS = 8;

function tidePath(t: number): string {
  const bob = Math.sin(t * Math.PI * 2);
  return `M5 88 Q17 ${77 + bob * 7} 30 86 T62 86 M7 94 Q25 ${83 - bob * 5} 39 92 T66 90`;
}

const tideSampler: MorphSampler = () => ({ opacity: 1 });

interface DashedFlowProps {
  size: number;
  d: string;
  stroke: string;
  strokeWidth: number;
  dash: number;
  gap: number;
}

/** The original offset travelled 180 viewBox units per loop. */
const FLOW_TRAVEL = 180;

/** A dashed highlight whose dashes slide along `d`. */
const DashedFlow = memo<DashedFlowProps>(({ size, d, stroke, strokeWidth, dash, gap }) => {
  const renderDashes = useCallback(
    (dashOffset: number, s: number) => (
      <Svg width={s} height={s} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    ),
    [d, stroke, strokeWidth, dash, gap],
  );
  return (
    <LoopDashFlow
      size={size}
      durationMs={MYTHIC_LOOP_DURATION}
      dashPeriod={dash + gap}
      travel={FLOW_TRAVEL}
      renderDashes={renderDashes}
    />
  );
});
DashedFlow.displayName = 'DashedFlow';

function CollectionFlair({ size, collection }: FlairProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const unit = size / VIEWBOX;
  const weaveBoxPx = WEAVE_BOX * unit;

  const renderTide = useCallback(
    (k: number, s: number) => (
      <Svg width={s} height={s} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Path
          d={tidePath(k / TIDE_VARIANTS)}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.3}
          strokeLinecap="round"
        />
      </Svg>
    ),
    [colors.primary],
  );

  const viewBox = `0 0 ${VIEWBOX} ${VIEWBOX}`;
  return (
    <View style={styles.wrapper}>
      {collection === 'astral' ? (
        <>
          {/* Squash is applied outside the rotation so the grid spins as a flat floor seen in perspective. */}
          <View
            style={[
              styles.perspective,
              {
                left: WEAVE_CX * unit - weaveBoxPx / 2,
                top: WEAVE_CY * unit - weaveBoxPx / 2,
                width: weaveBoxPx,
                height: weaveBoxPx,
                transform: [{ scaleY: WEAVE_SQUASH }],
              },
            ]}
          >
            <LoopLayer
              sample={weaveSampler}
              size={size}
              durationMs={MYTHIC_LOOP_DURATION}
              width={weaveBoxPx}
              height={weaveBoxPx}
            >
              <Svg
                width={weaveBoxPx}
                height={weaveBoxPx}
                viewBox={`${-WEAVE_BOX / 2} ${-WEAVE_BOX / 2} ${WEAVE_BOX} ${WEAVE_BOX}`}
              >
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
              </Svg>
            </LoopLayer>
          </View>
          <LoopLayer
            sample={starsSampler}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            width={size}
            height={size}
          >
            <Svg width={size} height={size} viewBox={viewBox}>
              <Path
                d="M15 79 v-7 m-3 3 h6 M34 85 v-9 m-4 4 h8 M54 78 v-6 m-3 3 h6"
                stroke={colors.pearl}
                strokeWidth={1.2}
              />
            </Svg>
          </LoopLayer>
        </>
      ) : collection === 'ocean' ? (
        <>
          <LoopMorph
            sample={tideSampler}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            variantCount={TIDE_VARIANTS}
            mode="stacked"
            renderVariant={renderTide}
          />
          <DashedFlow
            size={size}
            d="M5 91 Q20 80 35 89 T66 89"
            stroke={colors.pearl}
            strokeWidth={1.3}
            dash={5}
            gap={9}
          />
          <LoopLayer
            sample={starsSampler}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            width={size}
            height={size}
          >
            <Svg width={size} height={size} viewBox={viewBox}>
              <Path
                d="M16 83 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 M46 89 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6"
                fill="none"
                stroke={colors.secondary}
              />
            </Svg>
          </LoopLayer>
        </>
      ) : (
        <>
          <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
            <Path
              d="M4 92 L16 76 L24 85 L38 69 L48 85 L58 78 L68 93 Z"
              fill={colors.dark}
              opacity={0.8}
            />
            <Path d="M9 92 L21 83 L29 89 L40 79 L54 93 Z" fill={colors.primary} />
            <Path d="M33 78 L38 69 L43 78 M11 83 L16 76 L20 82" fill="none" stroke={colors.pearl} />
          </Svg>
          <DashedFlow
            size={size}
            d="M15 94 Q24 88 35 93 T63 94"
            stroke={colors.pearl}
            strokeWidth={1.6}
            dash={14}
            gap={9}
          />
          <LoopLayer
            sample={starsSampler}
            size={size}
            durationMs={MYTHIC_LOOP_DURATION}
            width={size}
            height={size}
          >
            <Svg width={size} height={size} viewBox={viewBox}>
              <Path d="M15 76 l4 -2 l-2 5 Z M51 82 l5 -3 l-2 5 Z" fill={colors.secondary} />
            </Svg>
          </LoopLayer>
        </>
      )}
    </View>
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

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  perspective: { position: 'absolute' },
});

/** Mythic sanctum: a rotating floor sigil and rising light beneath the avatar; no state or IO. */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';
import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';

import type { FlairProps } from './FlairProps';

/** Artwork is authored in a 100 × 100 viewBox. */
const VIEWBOX = 100;
/** Sigil centre in viewBox units (`translate(40 87)` in the original group). */
const SIGIL_CX = 40;
const SIGIL_CY = 87;
/** Floor perspective squash (`scale(1 .24)` in the original group). */
const SIGIL_SQUASH = 0.24;
/** Sigil artwork reaches ±35 units plus stroke; box edge in viewBox units. */
const SIGIL_BOX = 76;
/** Rising ticks start at y = 86 and climb 18 units twice per loop. */
const TICKS_BASE_Y = 86;
const TICKS_RISE = 18;

const sigilSampler: LayerSampler = (t, size) => {
  const box = (SIGIL_BOX / VIEWBOX) * size;
  return { x: box / 2, y: box / 2, rotateDeg: t * 360, scaleX: 1, scaleY: 1, opacity: 1 };
};

const ticksSampler: LayerSampler = (t, size) => {
  const phase = (t * 2) % 1;
  return {
    x: size / 2,
    y: size / 2 - (phase * TICKS_RISE * size) / VIEWBOX,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: Math.sin(phase * Math.PI) * 0.8,
  };
};

export const NightSanctumFlair = memo<FlairProps>(({ size }) => {
  const unit = size / VIEWBOX;
  const sigilBoxPx = SIGIL_BOX * unit;
  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Ellipse
          cx={SIGIL_CX}
          cy={90}
          rx={32}
          ry={7.5}
          fill="none"
          stroke={MYTHIC_COLORS.crimson}
          strokeWidth={1.8}
          opacity={0.3}
        />
        <G transform={`translate(${SIGIL_CX} ${SIGIL_CY}) scale(1 ${SIGIL_SQUASH})`}>
          <Circle r={32} fill="none" stroke={MYTHIC_COLORS.enamel} strokeWidth={2} opacity={0.8} />
        </G>
      </Svg>
      {/* Squash is applied outside the rotation so the sigil spins as a flat disc seen in perspective. */}
      <View
        style={[
          styles.sigilPerspective,
          {
            left: SIGIL_CX * unit - sigilBoxPx / 2,
            top: SIGIL_CY * unit - sigilBoxPx / 2,
            width: sigilBoxPx,
            height: sigilBoxPx,
            transform: [{ scaleY: SIGIL_SQUASH }],
          },
        ]}
      >
        <LoopLayer
          sample={sigilSampler}
          size={size}
          durationMs={MYTHIC_LOOP_DURATION}
          width={sigilBoxPx}
          height={sigilBoxPx}
        >
          <Svg
            width={sigilBoxPx}
            height={sigilBoxPx}
            viewBox={`${-SIGIL_BOX / 2} ${-SIGIL_BOX / 2} ${SIGIL_BOX} ${SIGIL_BOX}`}
          >
            <Circle
              r={28}
              fill="none"
              stroke={MYTHIC_COLORS.silver}
              strokeWidth={3}
              strokeDasharray="12 8 3 8"
            />
            <Path
              d="M0 -21 L18 10 H-18 Z M0 21 L-18 -10 H18 Z"
              fill="none"
              stroke={MYTHIC_COLORS.crimson}
              strokeWidth={2}
            />
            <Path
              d="M-4 -35 H4 M35 -4 V4 M-4 35 H4 M-35 -4 V4"
              fill="none"
              stroke={MYTHIC_COLORS.pearl}
              strokeWidth={3}
            />
          </Svg>
        </LoopLayer>
      </View>
      <LoopLayer
        sample={ticksSampler}
        size={size}
        durationMs={MYTHIC_LOOP_DURATION}
        width={size}
        height={size}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Path
            d={`M19 ${TICKS_BASE_Y} v-4 M37 ${TICKS_BASE_Y + 3} v-7 M57 ${TICKS_BASE_Y + 1} v-3`}
            fill="none"
            stroke={MYTHIC_COLORS.crystal}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </Svg>
      </LoopLayer>
    </View>
  );
});
NightSanctumFlair.displayName = 'NightSanctumFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  sigilPerspective: { position: 'absolute' },
});

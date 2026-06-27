/**
 * FrameOverlay — decorative avatar frame layer (SVG + optional legendary shimmer).
 *
 * Renders ONLY the frame, sized to overflow the avatar box by 8% on each side
 * (viewBox "-8 -8 116 116"). MUST live inside an `overflow: visible` parent so the
 * outward decorations are not clipped. Extracted from AvatarWithFrame so the frame can
 * be composed as a non-clipped sibling of clipping animation wrappers (SeatTile entrance
 * animations clip children with `overflow: hidden`, which would cut the frame).
 * Returns null when no frame is equipped. No service imports, no business logic.
 */
import { LEGENDARY_FRAME_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { getFrameById } from '@/components/avatarFrames';
import { LegendaryShimmer } from '@/components/avatarFrames/LegendaryShimmer';
import { borderRadius as themeBorderRadius } from '@/theme';

/**
 * Frame SVG viewBox = "-8 -8 116 116" → 8 units padding each side.
 * SVG element is sized to (size * 116/100), offset by -(size * 8/100)
 * so viewBox coords 0-100 map pixel-perfectly to the avatar bounds.
 */
const VB_PAD = 8;
const VB_TOTAL = 100 + VB_PAD * 2; // 116

interface FrameOverlayProps {
  /** Frame ID. null / undefined renders nothing. */
  frameId?: string | null;
  /** Avatar size in px. The frame overlays this box, overflowing 8% outward. */
  size: number;
  /** Avatar corner radius; the frame rect rx matches it for pixel-perfect alignment. */
  borderRadius?: number;
}

const FrameOverlayComponent: React.FC<FrameOverlayProps> = ({ frameId, size, borderRadius }) => {
  const frameConfig = useMemo(() => getFrameById(frameId as string), [frameId]);

  if (!frameConfig) {
    return null;
  }

  const innerRadius = borderRadius ?? themeBorderRadius.medium;
  const { Component: FrameComponent } = frameConfig;
  const svgSize = (size * VB_TOTAL) / 100;
  const svgOffset = (-size * VB_PAD) / 100;
  const rxVB = (innerRadius * 100) / size;
  const isLegendary = LEGENDARY_FRAME_IDS.has(frameId as string);

  return (
    <>
      <View style={[styles.frameOverlay, { left: svgOffset, top: svgOffset }]}>
        <FrameComponent size={svgSize} rx={rxVB} />
      </View>
      {isLegendary && (
        <View style={[styles.frameOverlay, { left: svgOffset, top: svgOffset }]}>
          <LegendaryShimmer size={svgSize} rx={rxVB} />
        </View>
      )}
    </>
  );
};

export const FrameOverlay = memo(FrameOverlayComponent);

const styles = StyleSheet.create({
  frameOverlay: {
    position: 'absolute',
    overflow: 'visible',
    pointerEvents: 'none',
  },
});

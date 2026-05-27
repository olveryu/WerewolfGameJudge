/**
 * AvatarWithFrame — Avatar + optional decorative frame wrapper component.
 *
 * `size` always refers to the avatar size. Without a frame, behaves exactly like Avatar.
 * With a frame, the frame SVG renders at viewBox "-8 -8 116 116" —
 * the SVG is slightly larger than the avatar, aligned via negative offsets: viewBox coords
 * 0–100 cover the avatar edges; decorations at -8~0 / 100~108
 * overflow outward. Does not rely on overflow:visible SVG behavior.
 * Legendary frames additionally overlay a LegendaryShimmer layer (shimmer + glow pulse + stardust).
 * Memoized to avoid unnecessary re-renders. No service imports, no business logic.
 */
import { LEGENDARY_FRAME_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
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

interface AvatarWithFrameProps {
  value: string;
  /** Avatar size in px. Meaning unchanged with or without a frame. */
  size: number;
  avatarUrl?: string | null;
  borderRadius?: number;
  /** Frame ID. null / undefined = no frame. */
  frameId?: string | null;
}

const AvatarWithFrameComponent: React.FC<AvatarWithFrameProps> = ({
  size,
  frameId,
  value,
  avatarUrl,
  borderRadius,
}) => {
  const frameConfig = useMemo(() => getFrameById(frameId as string), [frameId]);

  if (!frameConfig) {
    return <Avatar value={value} size={size} avatarUrl={avatarUrl} borderRadius={borderRadius} />;
  }

  const innerRadius = borderRadius ?? themeBorderRadius.medium;
  const { Component: FrameComponent } = frameConfig;
  const svgSize = (size * VB_TOTAL) / 100;
  const svgOffset = (-size * VB_PAD) / 100;
  const rxVB = (innerRadius * 100) / size;
  const isLegendary = LEGENDARY_FRAME_IDS.has(frameId as string);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Avatar
        value={value}
        size={size}
        avatarUrl={avatarUrl}
        borderRadius={innerRadius}
        hideBackground
      />
      <View style={[styles.frameOverlay, { left: svgOffset, top: svgOffset }]}>
        <FrameComponent size={svgSize} rx={rxVB} />
      </View>
      {isLegendary && (
        <View style={[styles.frameOverlay, { left: svgOffset, top: svgOffset }]}>
          <LegendaryShimmer size={svgSize} rx={rxVB} />
        </View>
      )}
    </View>
  );
};

export const AvatarWithFrame = memo(AvatarWithFrameComponent);

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  frameOverlay: {
    position: 'absolute',
    overflow: 'visible',
    pointerEvents: 'none',
  },
});

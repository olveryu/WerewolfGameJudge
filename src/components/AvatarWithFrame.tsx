/**
 * AvatarWithFrame — Avatar + optional decorative frame wrapper component.
 *
 * `size` always refers to the avatar size. Without a frame, behaves exactly like Avatar.
 * With a frame, FrameOverlay renders the decorative SVG (overflowing the avatar by 8%) on
 * top of the avatar inside an `overflow: visible` container. Used where avatar + frame render
 * as one unclipped unit; clipping animation wrappers (SeatTile entrance) compose Avatar and
 * FrameOverlay separately instead so the frame is never clipped.
 * Memoized to avoid unnecessary re-renders. No service imports, no business logic.
 */
import type React from 'react';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { getFrameById } from '@/components/avatarFrames';
import { FrameOverlay } from '@/components/FrameOverlay';
import { borderRadius as themeBorderRadius } from '@/theme';

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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Avatar
        value={value}
        size={size}
        avatarUrl={avatarUrl}
        borderRadius={innerRadius}
        hideBackground
      />
      <FrameOverlay frameId={frameId} size={size} borderRadius={innerRadius} />
    </View>
  );
};

export const AvatarWithFrame = memo(AvatarWithFrameComponent);

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
});

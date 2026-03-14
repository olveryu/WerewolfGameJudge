/**
 * AvatarWithFrame — 头像 + 可选装饰框包装组件
 *
 * 无 frame 时渲染原始 Avatar（行为完全不变）。
 * 有 frame 时 Avatar 稍微缩小，外层叠加 SVG 装饰框。
 * Memoized 以避免不必要重渲染。不 import service，不含业务逻辑。
 */
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { type FrameId, getFrameById } from '@/components/avatarFrames';

interface AvatarWithFrameProps {
  value: string;
  size: number;
  avatarUrl?: string | null;
  roomId?: string;
  avatarIndex?: number;
  borderRadius?: number;
  /** 头像框 ID。null / undefined = 无框。 */
  frameId?: FrameId | string | null;
}

/** Avatar 相对于外框的内缩比例（8%） */
const FRAME_INSET_RATIO = 0.08;

const AvatarWithFrameComponent: React.FC<AvatarWithFrameProps> = ({
  size,
  frameId,
  value,
  avatarUrl,
  roomId,
  avatarIndex,
  borderRadius,
}) => {
  const frameConfig = useMemo(() => getFrameById(frameId as string), [frameId]);

  if (!frameConfig) {
    return (
      <Avatar
        value={value}
        size={size}
        avatarUrl={avatarUrl}
        roomId={roomId}
        avatarIndex={avatarIndex}
        borderRadius={borderRadius}
      />
    );
  }

  const inset = Math.round(size * FRAME_INSET_RATIO);
  const avatarSize = size - inset * 2;
  const innerRadius = borderRadius != null ? Math.max(0, borderRadius - inset) : undefined;
  const { Component: FrameComponent } = frameConfig;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.avatarInset, { top: inset, left: inset }]}>
        <Avatar
          value={value}
          size={avatarSize}
          avatarUrl={avatarUrl}
          roomId={roomId}
          avatarIndex={avatarIndex}
          borderRadius={innerRadius}
        />
      </View>
      <View style={styles.frameOverlay} pointerEvents="none">
        <FrameComponent size={size} />
      </View>
    </View>
  );
};

export const AvatarWithFrame = memo(AvatarWithFrameComponent);

const styles = StyleSheet.create({
  avatarInset: {
    position: 'absolute',
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
